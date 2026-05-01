import fs from 'fs/promises';
import path from 'path';
import { getOpenAIInstance } from '../config/openai.config.js';
import { getRedisClient } from '../config/redis.config.js';
import { createGoogleCalendarEvent,getBusyTimes } from '../services/google-calendar.service.js';
import e from 'cors';

export async function generateAIResponse({ userMessage, conversationHistory = [], userId }) {
  try {
    const promptPath = path.resolve('src/prompts/assistant.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    const analysis = await analyzeUserMessage(userMessage);
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ [AI] Redis no disponible');
    }
    // =========================
    // 🔑 REDIS KEYS
    // =========================
    const clientNameKey = userId ? `clientName:${userId}` : null;
    const clientEmailKey = userId ? `clientEmail:${userId}` : null;
    const addressKey = userId ? `address:${userId}` : null;
    const pendingReservationKey = userId ? `pendingReservation:${userId}` : null;
    const phaseKey = `reservationPhase:${userId}`;
    const session = await getSessionRedis(redis, userId);
    const preferedDateKey = userId ? `preferedDate:${userId}` : null;
    const preferedTimeKey = userId ? `preferedTime:${userId}` : null;
    const serviceTypeKey = userId ? `serviceType:${userId}` : null;
    // =========================
    // 🧠 EXTRACCIÓN SIMPLE
    // =========================
    // Limpieza de saludos y frases comunes para mejorar extracción
    let lowerUserMessage = userMessage.toLowerCase();
    let cleanMessage = userMessage
      .replace(/^(hola|buenos días|buenas tardes|buenas noches|hey|buen día|saludos)[,!.\s]*/i, '')
      .replace(/[,!.]$/g, '')
      .trim();
    let detectedName = null;
    let clientName = await redis.get(clientNameKey);
    if (!clientName) {
      const nameMatch = cleanMessage.match(
        /\b(mi nombre es|me llamo|soy|yo soy|me dicen|puedes llamarme|soy el|soy la)\b[\s,:-]*([a-záéíóúüñ.'\-\s]{2,60})/i
      );

      if (nameMatch) {
        let rawName = nameMatch[2].replace(/[,!.].*$/, '').trim();
        let nameParts = rawName.split(' ').filter(Boolean);
        detectedName = nameParts.slice(0, 3).join(' ');
      } else {
        detectedName = verificarSiElMensajeEsSoloNombre(cleanMessage);
      }
    }

    const emailMatch = userMessage.match(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);

    // 🔥 MEJOR DETECCIÓN DE DIRECCIÓN
    let detectedAddress = null;
    
    // Caso con frase clara
    const addressMatch = userMessage.match(
      /(mi dirección es|vivo en|estoy en|me ubico en|queda en|ubicado en)\s+(.+)/i
    );

    if (addressMatch) {
      detectedAddress = addressMatch[2].trim();
    } else {
      // Nueva heurística: solo aceptar si hay palabra clave de dirección Y número
      const hasNumber = /\d+/.test(userMessage);
      const hasStreetWords = /(calle|avenida|av\.?|colonia|col\.?|cp|c\.p\.?|número|numero|interior|int|mz|lote)/i.test(userMessage);
      const looksLikeNonAddress = /(visita|cita|agendar|agenda|día|hora|mañana|tarde|perfecto|ok|gracias|servicio|precio|cotización|información|info|solo estoy viendo|comparando|quiero saber|hola|buenos|buenas|gracias)/i.test(userMessage);
      const isLongEnough = userMessage.length > 10;
      // Solo aceptar si hay palabra de calle Y número, no solo número y palabras
      if (hasStreetWords && hasNumber && !looksLikeNonAddress && isLongEnough) {
        detectedAddress = userMessage.trim();
      }
    }
    const detectedEmail = emailMatch?.[1] || null;

    // =========================
    // 💾 GUARDAR EN REDIS
    // =========================
    if (!clientName && detectedName) {
      await redis.setEx(clientNameKey, 3600, detectedName);
      clientName = detectedName; // 🔥 FIX CLAVE

      // 🔥 marcar inicio de sesión
      session.hasStarted = true;
      await saveSessionRedis(redis, userId, session);
    }

    if (clientEmailKey && detectedEmail) {
      await redis.setEx(clientEmailKey, 3600, detectedEmail);
    }

    if (addressKey && detectedAddress) {
      const isCDMX = isCDMXAddress(detectedAddress);

      if (!isCDMX) {
        return {
          reply: `Para poder ayudarte mejor, por ahora solo trabajamos en Ciudad de México 📍  
    ¿Tu proyecto se encuentra en CDMX?`,
          reservationRequest: false,
          reservationData: null
        };
      }

      await redis.setEx(addressKey, 3600, detectedAddress);
    }
    if (serviceTypeKey && analysis?.tipo_servicio) {
      await redis.setEx(serviceTypeKey, 3600, analysis.tipo_servicio);
    }
    // 🛑 CONTROL DE ONBOARDING
       if (!clientName && !session.hasStarted) {
      session.hasStarted = true;
      await saveSessionRedis(redis, userId, session);

      return {
        reply: `Hola 👋, te atiende Gerardo de Constructumex.  
¿Con quién tengo el gusto?`,
        reservationRequest: false,
        reservationData: null
      };
    }
    // =========================
    // 🔄 RECUPERAR
    // =========================
    const clientEmail = clientEmailKey ? await redis.get(clientEmailKey) : null;
    const serviceType = serviceTypeKey ? await redis.get(serviceTypeKey) : null;
    let phase = await redis.get(phaseKey);
    // default
    if (!phase) {
      phase = 'phase1';
    }
    const address = addressKey ? await redis.get(addressKey) : null;
    const preferedDate = preferedDateKey ? await redis.get(preferedDateKey) : null;
    const preferedTime = preferedTimeKey ? await redis.get(preferedTimeKey) : null;
    const confirmAppointment =
      /\b(si|sí|ok|vale|va|dale|perfecto|me parece|claro|por favor|hazlo|agendalo|agéndalo)\b.*\b(cita|visita|agendar|agenda|programar|ir)\b/i
        .test(lowerUserMessage);
    const simpleConfirmation =
      /^(si|sí|ok|vale|va|dale|perfecto|me parece|claro|por favor|hazlo|agendalo|agéndalo)$/i
        .test(lowerUserMessage.trim());
    const negativeSoft =
      /(precio|cotización|información|info|solo estoy viendo|comparando|quiero saber)/i
        .test(lowerUserMessage);
    const intentType = revisarSiEsSolicitudDeReserva(lowerUserMessage);
    let reservationData = null;

if (intentType === 'soft' && negativeSoft && !session.inReservationFlow) {
      session.awaitingAppointmentConfirmation = true;
      session.inReservationFlow = false;
      await saveSessionRedis(redis, userId, session);
      return {
        reply: `Entiendo que estás buscando información. ¿Quieres que te ayude a agendar una visita técnica para revisar tu caso?`,
        reservationRequest: false,
        reservationData: null
      };
    }
    const revisarConfirmacion =
      session.awaitingAppointmentConfirmation &&
      (simpleConfirmation || confirmAppointment);
    // =========================
    // 🧠 FLUJO DE RESERVACIÓN
    // =========================
    if (
      (!negativeSoft) &&
      (
        intentType === 'hard' ||
        revisarConfirmacion ||
        session.awaitingAppointmentConfirmation ||
        session.inReservationFlow
      )
    ) {
      reservationData = await detectAndExtractReservationData(userMessage, conversationHistory);
      reservationData = {
        ...reservationData,
        clientName: clientName || reservationData.clientName,
        clientEmail: clientEmail || reservationData.clientEmail,
        address: address || reservationData.address,
        serviceType: serviceType || analysis.tipo_servicio || reservationData.serviceType,
        preferredDate: preferedDate || reservationData.preferredDate,
        preferredTime: preferedTime || reservationData.preferredTime
      };
      const suggestedSlots = session.suggestedSlots || [];
      // Mejor lógica: si el usuario responde con número, o con texto que coincide razonablemente con un slot sugerido, tomar ese slot
      let selectedSlot = getSelectedSlotByIndex(userMessage, suggestedSlots);
      if (!selectedSlot) {
        // Intentar match flexible por texto (ej: "hoy a las 6 de la tarde")
          selectedSlot = matchUserToSlot(userMessage, suggestedSlots);

      }
      if (selectedSlot) {
        const date = new Date(selectedSlot.iso);
        reservationData.preferredDate = date.toISOString().split('T')[0];
        reservationData.preferredTime = date.toISOString().split('T')[1].slice(0,5);
        await redis.setEx(preferedDateKey, 3600, reservationData.preferredDate);
        await redis.setEx(preferedTimeKey, 3600, reservationData.preferredTime);
        await redis.setEx(phaseKey, 900, 'phase2');
        // 🔥 avanzar flujo
      }
      if (revisarConfirmacion) {
        session.awaitingAppointmentConfirmation = false;
        session.inReservationFlow = true;
        await saveSessionRedis(redis, userId, session);
      }
      const { missingPhase1, missingPhase2 } = buildMissing(reservationData);
      if (
        missingPhase1.length === 0 &&
        missingPhase2.length === 0 &&
        reservationData.shouldReserve
      ) {
        // 🔒 Validación reforzada de disponibilidad
        const busySlots = await getBusyTimes();
        let slotDateTime = null;
        try {
          if (reservationData.preferredDate && reservationData.preferredTime) {
            const [year, month, day] = reservationData.preferredDate.split('-');
            const [hour, minute] = reservationData.preferredTime.split(':');
            slotDateTime = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hour),
              parseInt(minute),
              0, 0
            );
          }
        } catch (e) {}
        let slotOk = false;
        if (slotDateTime) {
          slotOk = isSlotAvailable(slotDateTime, busySlots, 60);
        }
        // 🔎 DEBUG: Mostrar reservationData antes de confirmar
        console.log('[DEBUG][RESERVATION] reservationData final:', JSON.stringify(reservationData, null, 2));
        if (!slotOk) {
          // Buscar siguiente horario disponible
          let nextSlot = new Date(slotDateTime);
          let found = false;
          for (let i = 1; i <= 10; i++) {
            nextSlot.setHours(nextSlot.getHours() + 1);
            if (nextSlot.getHours() < 9 || nextSlot.getHours() > 19) continue;
            if (isSlotAvailable(nextSlot, busySlots, 60)) {
              found = true;
              break;
            }
          }
          let sugerencia = found
            ? `${nextSlot.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${String(nextSlot.getHours()).padStart(2, '0')}:00`
            : 'próximamente';
          return {
            reply: `⚠️ El horario que seleccionaste ya está ocupado. Te propongo: ${sugerencia}\n¿Te funciona ese horario?` ,
            reservationRequest: false,
            reservationData: {
              ...reservationData,
              suggestedDate: found ? nextSlot.toISOString().split('T')[0] : null,
              suggestedTime: found ? `${String(nextSlot.getHours()).padStart(2, '0')}:00` : null
            }
          };
        }
        // Si está disponible, continuar
        session.inReservationFlow = false;
        session.awaitingAppointmentConfirmation = false;
        await saveSessionRedis(redis, userId, session);
        await redis.del(phaseKey);
        return {
          reply: `Perfecto 👍 ya tengo todos los datos para agendar tu visita.`,
          reservationRequest: true,
          reservationData
        };
      }
      if (reservationData && typeof reservationData === 'object') {
        await redis.setEx(
          pendingReservationKey,
          900,
          JSON.stringify(reservationData)
        );
      }
      // =========================
      // 🟢 FASE 1 → pedir fecha/hora
      // =========================
      if (phase === 'phase1') {

        if (missingPhase1.length > 0) {

          await redis.setEx(phaseKey, 900, 'phase1');

          return {
            reply: `Perfecto 👍 puedo ayudarte con la visita técnica.
Solo dime qué día y a qué hora te queda mejor 📅⏰  
Por ejemplo: "mañana a las 5pm" o "el viernes por la mañana`,
            reservationRequest: false,
            reservationData: {
              ...reservationData,
              missingData: missingPhase1
            }
          };
        }
        // 🔥 pasar a fase 2
        await redis.setEx(phaseKey, 900, 'phase2');
      }
      // =========================
      // 🔵 FASE 2 → pedir datos personales
      // =========================
      else if (phase === 'phase2') {

        if (missingPhase2.length > 0) {

          await redis.setEx(phaseKey, 900, 'phase2');
          let reply = `Excelente 👍 ya casi terminamos.\n\n`;

          if (missingPhase2.includes("Nombre completo") && missingPhase2.includes("Dirección completa")) {
            reply += `Solo necesito tu nombre y la dirección donde se realizará la visita 📍`;
          }
          else if (missingPhase2.includes("Nombre completo")) {
            reply += `Solo me falta tu nombre para continuar 🙂`;
          }
          else if (missingPhase2.includes("Dirección completa")) {
            reply += `¿Me compartes la dirección donde se realizará la visita? 📍`;
          }

          // ejemplo solo si falta dirección
          if (missingPhase2.includes("Dirección completa")) {
            reply += `\n\nEjemplo: "Av Reforma 500, Colonia Centro"`;
          }

          return {
            reply,
            reservationRequest: false,
            reservationData: {
              ...reservationData,
              missingData: missingPhase2
            }
          };
        }
      }
    }

    // =========================
    // 🔄 CONTINUAR RESERVACIÓN
    // =========================
    const pendingStr = await redis.get(pendingReservationKey);

    if (!pendingStr) {
      session.inReservationFlow = false;
      await saveSessionRedis(redis, userId, session);
    }
    if (pendingStr) {
      let pending = JSON.parse(pendingStr);

      const extracted = await detectAndExtractReservationData(userMessage, conversationHistory);

      reservationData = {
        ...pending,
        ...extracted,
        clientName: detectedName || clientName || pending.clientName,
        address: detectedAddress || address || pending.address,
        clientEmail: detectedEmail || clientEmail || pending.clientEmail,
        preferredDate: preferedDate || pending.preferredDate,
        preferredTime: preferedTime || pending.preferredTime,
        serviceType: serviceType || analysis.tipo_servicio || reservationData.serviceType
      };
      // Mejor lógica: si el usuario responde con número, o con texto que coincide razonablemente con un slot sugerido, tomar ese slot
      const suggestedSlots = session.suggestedSlots || [];
      let selectedSlot = getSelectedSlotByIndex(userMessage, suggestedSlots);
      if (!selectedSlot) {
        // Intentar match flexible por texto (ej: "hoy a las 6 de la tarde")
          selectedSlot = matchUserToSlot(userMessage, suggestedSlots);

      }
      if (selectedSlot) {
        const date = new Date(selectedSlot.iso);
        reservationData.preferredDate = date.toISOString().split('T')[0];
        reservationData.preferredTime = date.toISOString().split('T')[1].slice(0,5);
        await redis.setEx(preferedDateKey, 3600, reservationData.preferredDate);
        await redis.setEx(preferedTimeKey, 3600, reservationData.preferredTime);
        await redis.setEx(phaseKey, 900, 'phase2');
        // 🔥 avanzar flujo
      }
      const { missingPhase1, missingPhase2 } = buildMissing(reservationData);
      if (missingPhase1.length === 0 &&
        missingPhase2.length === 0 &&
        reservationData.shouldReserve) {
        if (pendingReservationKey) {
          await redis.del(pendingReservationKey);
        }

        return {
          reply: `Perfecto 👍 ya tengo todos los datos para agendar tu visita.`,
          reservationRequest: true,
          reservationData
        };
      }

      if (pendingReservationKey && reservationData && typeof reservationData === 'object') {
        await redis.setEx(
          pendingReservationKey,
          900,
          JSON.stringify(reservationData)
        );
      }


      if (phase === 'phase1') {

        if (missingPhase1.length > 0) {

          await redis.setEx(phaseKey, 900, 'phase1');

          return {
            reply: `Perfecto 👍 puedo ayudarte con la visita técnica.
Solo dime qué día y a qué hora te queda mejor 📅⏰  
Por ejemplo: "mañana a las 5pm" o "el viernes por la mañana`,
            reservationRequest: false,
            reservationData: {
              ...reservationData,
              missingData: missingPhase1
            }
          };
        }
        // 🔥 pasar a fase 2
        await redis.setEx(phaseKey, 900, 'phase2');
      }
      // =========================
      // 🔵 FASE 2 → pedir datos personales
      // =========================
      if (phase === 'phase2') {

        if (missingPhase2.length > 0) {

          await redis.setEx(phaseKey, 900, 'phase2');
          let reply = `Excelente 👍 ya casi terminamos.\n\n`;

          if (missingPhase2.includes("Nombre completo") && missingPhase2.includes("Dirección completa")) {
            reply += `Solo necesito tu nombre y la dirección donde se realizará la visita 📍`;
          }
          else if (missingPhase2.includes("Nombre completo")) {
            reply += `Solo me falta tu nombre para continuar 🙂`;
          }
          else if (missingPhase2.includes("Dirección completa")) {
            reply += `¿Me compartes la dirección donde se realizará la visita? 📍`;
          }

          // ejemplo solo si falta dirección
          if (missingPhase2.includes("Dirección completa")) {
            reply += `\n\nEjemplo: "Av Reforma 500, Colonia Centro"`;
          }

          return {
            reply,
            reservationRequest: false,
            reservationData: {
              ...reservationData,
              missingData: missingPhase2
            }
          };
        }
      }

    }
    const now = new Date();

    const dateTime = {
      date: now.toLocaleDateString('en-CA'), // formato ISO local
      time: now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      timestamp: now.getTime()
    };
    const busySlots = await getBusyTimes(); 
    const suggestedDates = await getMultipleSuggestedDates(busySlots, {
      limit: 3
    });
    const suggestedText = formatMultipleSuggestedDates(suggestedDates);

    // =========================
    // 🤖 RESPUESTA NORMAL
    // =========================
    const aiResponse = await generateContextualResponse({
      userMessage,
      conversationHistory,
      systemPrompt,
      analysis,
      dateTime,
      suggestedText
    });
    const suggestsAppointment =
      /\b(agendar|agenda|visita|cita|programar)\b/i.test(aiResponse);
    if (suggestsAppointment && !reservationData) {
      session.awaitingAppointmentConfirmation = true;
      console.log(session.awaitingAppointmentConfirmation);
      session.suggestedSlots  = suggestedDates.map((d, i) => ({
        index: i + 1,
        iso: d.toISOString()
      }));
      await saveSessionRedis(redis, userId, session);
    }
    return {
      reply: aiResponse,
      reservationRequest: false,
      reservationData: null
    };
  } catch (error) {
    console.error('❌ Error IA:', error);
    return { reply: 'Ocurrió un error. Intenta nuevamente.' };
  }
}

function matchUserToSlot(userMessage, suggestedSlots) {
  const msg = userMessage.toLowerCase();

  const isToday = msg.includes('hoy');
  const isTomorrow = msg.includes('mañana');

  const hourMatch = msg.match(/\b(\d{1,2})\b/);
  const userHour = hourMatch ? parseInt(hourMatch[1], 10) : null;

  if (!userHour) return null;

  return suggestedSlots.find(slot => {
    const date = new Date(slot.iso);

    const slotHour24 = date.getHours();
    const slotHour12 = slotHour24 % 12 || 12;

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);

    const isSlotToday =
      date.toDateString() === now.toDateString();

    const isSlotTomorrow =
      date.toDateString() === tomorrow.toDateString();

    // ✅ hora exacta
    const hourMatch =
      userHour === slotHour12 || userHour === slotHour24;

    // ✅ contexto día (solo si lo mencionó)
    const dayMatch =
      (!isToday && !isTomorrow) ||
      (isToday && isSlotToday) ||
      (isTomorrow && isSlotTomorrow);

    return hourMatch && dayMatch;
  }) || null;
}
function getSelectedSlotByIndex(userMessage, suggestedSlots) {
  const match = userMessage.match(/\b(\d{1,2})\b/);

  if (!match) return null;

  const index = parseInt(match[1], 10);

  return suggestedSlots.find(slot => slot.index === index) || null;
}
function isCDMXAddress(address) {
  if (!address) return false;
  const CDMX_ALCALDIAS = [
  'alvaro obregon',
  'azcapotzalco',
  'benito juarez',
  'coyoacan',
  'cuajimalpa',
  'cuauhtemoc',
  'gustavo a madero',
  'iztacalco',
  'iztapalapa',
  'magdalena contreras',
  'miguel hidalgo',
  'milpa alta',
  'tlahuac',
  'tlalpan',
  'venustiano carranza',
  'xochimilco'
];
  const text = address.toLowerCase();

  // 🔹 1. Detectar CP
  const cpMatch = text.match(/\b\d{5}\b/);
  if (cpMatch) {
    const cp = parseInt(cpMatch[0], 10);

    // CP CDMX van aprox de 01000 a 16999
    if (cp >= 1000 && cp <= 16999) {
      return true;
    }
  }

  // 🔹 2. Detectar alcaldía
  const hasAlcaldia = CDMX_ALCALDIAS.some(alc =>
    text.includes(alc)
  );

  if (hasAlcaldia) return true;

  // 🔹 3. Detectar texto explícito
  if (
    text.includes('cdmx') ||
    text.includes('ciudad de mexico')
  ) {
    return true;
  }

  return false;
}
 async function getSessionRedis(redis, userId) {
  const sessionKey = `session:${userId}`;
  const sessionStr = await redis.get(sessionKey);

  if (!sessionStr) {
    return {
      awaitingAppointmentConfirmation: false,
      suggestedSlots : [],
      inReservationFlow : false,
      hasStarted: false,
      lastBotMessage: null
    };
  }

  return JSON.parse(sessionStr);
}

async function saveSessionRedis(redis, userId, session) {
  const sessionKey = `session:${userId}`;

  await redis.setEx(
    sessionKey,
    3600, // 1 hora TTL
    JSON.stringify(session)
  );
}

async function getMultipleSuggestedDates(
  busySlots,
  {
    limit = 3,          // cuántas opciones quieres devolver
    searchHours = 72,   // cuántas horas hacia adelante buscar
    startOffsetHours = 4, // empezar en +4h desde ahora
    workStart = 9,
    workEnd = 19,
    slotMinutes = 60
  } = {}
) {
  const now = new Date();

  // 🔥 punto inicial (+4 horas)
  let date = new Date(now);
  date.setHours(date.getHours() + startOffsetHours);

  // 🔥 redondear a siguiente bloque exacto
  if (date.getMinutes() > 0) {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
  } else {
    date.setSeconds(0, 0);
  }

  const suggestions = [];

  for (let i = 0; i < searchHours; i++) {

    const hour = date.getHours();

    // ✅ dentro de horario laboral
    if (hour >= workStart && hour <= workEnd) {

      if (isSlotAvailable(date, busySlots, slotMinutes)) {
        suggestions.push(new Date(date)); // ⚠️ clonar fecha

        if (suggestions.length >= limit) {
          break; // 🔥 ya tenemos suficientes
        }
      }
    }

    // 👉 siguiente bloque
    date.setMinutes(date.getMinutes() + slotMinutes);

    // 👉 si se pasa del horario → siguiente día a las 9
    if (date.getHours() > workEnd) {
      date.setDate(date.getDate() + 1);
      date.setHours(workStart, 0, 0, 0);
    }
  }

  return suggestions; // 👈 ARRAY de fechas
}function formatMultipleSuggestedDates(dates) {
  return dates
    .map((date, i) => {
      const label = i === 0
        ? 'Primera opción'
        : i === 1
        ? 'Otra opción'
        : 'También disponible';

      return `${i + 1}. ${label}: ${formatSuggestedDate(date)}`;
    })
    .join('\n');
}
function formatSuggestedDate(date) {
  return date.toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
function isSlotAvailable(date, busySlots, durationMinutes = 60) {
  const start = date.getTime();
  const end = start + durationMinutes * 60 * 1000;

  return !busySlots.some(slot => {
    const busyStart = new Date(slot.start).getTime();
    const busyEnd = new Date(slot.end).getTime();

    return start < busyEnd && end > busyStart;
  });
}
function buildMissing(reservationData) {
  const missingPhase1 = [];
  const missingPhase2 = [];

  if (!reservationData.preferredDate) missingPhase1.push("Fecha");
  if (!reservationData.preferredTime) missingPhase1.push("Hora");

  if (!reservationData.clientName) missingPhase2.push("Nombre completo");
  if (!reservationData.address) missingPhase2.push("Dirección completa");

  return { missingPhase1, missingPhase2 };
}
function verificarSiElMensajeEsSoloNombre(userMessage) {
  const clean = userMessage.trim()
    .replace(/[,!.]$/g, '')
    .replace(/\s{2,}/g, ' ');
  let detectedName = null;
  // Permitir nombres de hasta 60 caracteres, con letras, espacios, puntos y guiones
  const isLikelyName =
    clean.length >= 2 &&
    clean.length <= 60 &&
    /^[a-záéíóúüñ.'\-\s]+$/i.test(clean) &&
    !/(hola|buenos|buenas|gracias|cita|precio|servicio|quiero|necesito|agenda|visita|problema|cotización|información|info|solo estoy viendo|comparando|quiero saber)/i.test(clean);

  if (isLikelyName) {
    // Si el nombre tiene más de 3 palabras, tomar solo las primeras 3
    let nameParts = clean.split(' ').filter(Boolean);
    detectedName = nameParts.slice(0, 3).join(' ');
    // Normalizar mayúsculas
    detectedName = detectedName.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }
  return detectedName;
}
function revisarSiEsSolicitudDeReserva(userMessage) {

  // 🔥 QUIERE QUE VAYAN (ALTA INTENCIÓN)
  const intentVisit =
    /(puedes venir|pueden venir|puedes pasar|pueden pasar|manda a alguien|manden a alguien|envía tecnico|envien tecnico|quiero que vengan|necesito que vengan)/i
      .test(userMessage);

  // 🔥 YA HABLA DE AGENDAR
  const intentSchedule =
    /(agendar|agenda|agendamos|agéndalo|cita|programar|reservar|apartar|qué día|qué hora|horario disponible)/i
      .test(userMessage);

  // 🔥 TIENE PROBLEMA (PERO NO NECESARIAMENTE AGENDA)
  const intentProblem =
    /(reparar|reparación|arreglar|falla|problema|no sirve|descompuesto|checar|revisar|diagnosticar)/i
      .test(userMessage);

  // =========================
  // 🧠 CLASIFICACIÓN
  // =========================

  // 🟢 INTENCIÓN FUERTE → ir directo a flujo
  if (intentVisit || intentSchedule) {
    return 'hard';
  }

  // 🟡 INTENCIÓN SUAVE → guiar primero
  if (intentProblem) {
    return 'soft';
  }

  return 'none';
}

/**
 * Analiza el mensaje de un usuario y devuelve:
 * - Intención del usuario
 * - Nivel de claridad
 * - Tipo de cliente
 * - Posible urgencia
 * El resultado es un objeto JSON.
 */

export async function analyzeUserMessage(userMessage) {
  try {
    const openai = getOpenAIInstance();

    const prompt = `
Analiza el mensaje y responde SOLO en JSON con:

{
  "intencion": "",
  "claridad": "claro | ambiguo",
  "tipo_cliente": "nuevo | recurrente | potencial",
  "urgencia": "alto | medio | bajo | no",
  "tipo_servicio": "servicio | menudeo | mayoreo"
}

Reglas urgencia:
- alto: urgente, fuga, corto, no funciona, hoy
- medio: pronto, esta semana
- bajo: cotización
- no: sin prisa

Reglas tipo_servicio:
- servicio: instalación, reparación, trabajo
- menudeo: compra simple
- mayoreo: volumen, negocio, precios especiales

Mensaje:
"""${userMessage}"""
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres analista experto.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    let text = completion.choices[0].message.content.trim();

    try {
      // Limpiar backticks y markdown si OpenAI retorna el JSON así
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Intentar extraer JSON si está dentro de texto
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }

      return JSON.parse(text);
    } catch (parseError) {
      console.warn('⚠️ No se pudo parsear análisis:', text);
      console.error('Error al parsear:', parseError.message);
      return { error: true, raw: text };
    }

  } catch (error) {
    console.error('❌ Error análisis:', error);
    return { error: true };
  }
}

/**
 * Genera una respuesta contextualizada usando el análisis del mensaje del usuario.
 * Utiliza analyzeUserMessage y luego genera una respuesta adecuada.
 */
export async function generateContextualResponse({
  userMessage,
  conversationHistory = [],
  systemPrompt,
  analysis,
  dateTime,
  suggestedText
}) {
  try {
    const openai = getOpenAIInstance();

    // 🔥 Flujo dinámico según tipo
    let tipoFlow = '';

    switch (analysis.tipo_servicio) {
      case 'servicio':
        tipoFlow = `
Enfócate en:
- Detectar problema
- Ofrecer solución
- Invitar a visita o instalación
`;
        break;

      case 'menudeo':
        tipoFlow = `
Enfócate en:
- Dar precio
- Beneficios del producto
- Cierre rápido
`;
        break;

      case 'mayoreo':
        tipoFlow = `
Enfócate en:
- Volumen
- Descuentos
- Relación comercial
- Solicitar datos del cliente
`;
        break;

      default:
        tipoFlow = `Responde de forma general y pide más información.`;
    }

    // 🔥 Manejo de urgencia
    let urgenciaFlow = '';

    switch (analysis.urgencia) {
      case 'alto':
        urgenciaFlow = `
El cliente tiene urgencia ALTA:
- Responde directo
- Prioriza solución inmediata
- Ofrece atención rápida
`;
        break;

      case 'medio':
        urgenciaFlow = `
El cliente tiene urgencia MEDIA:
- Motiva a tomar acción pronto
`;
        break;

      case 'bajo':
      case 'no':
        urgenciaFlow = `
El cliente no tiene urgencia:
- Educa
- Genera confianza
`;
        break;
    }

    const finalPrompt = `
${systemPrompt}
🕒 CONTEXTO DE TIEMPO:
- Fecha actual: ${dateTime?.date}
- Hora actual: ${dateTime?.time}
- Hora numérica: ${dateTime?.hour}
📅 HORARIO SUGERIDO:
Puedes proponer al cliente los siguientes horarios disponibles:

${suggestedText}

Instrucciones:
- Presenta los horarios como opciones claras
- Pide al cliente que elija una (puede responder con el número o la hora)
- Si ninguno le funciona, invítalo a proponer otro día u horario
- Mantén el mensaje natural y conversacional

Restricciones:
- No inventes horarios adicionales
- No modifiques los horarios proporcionados
Reglas para agendar:
- Horario disponible: 9:00 a 19:00
- Las citas son en bloques de 1 hora (ej: 10:00, 11:00)
- Si ya es tarde (después de las 18:00), sugiere el día siguiente
- Si el cliente tiene urgencia alta, sugiere el horario más cercano disponible
- Si es temprano, puedes sugerir "hoy"
- Nunca sugieras horas pasadas

📊 ANÁLISIS DEL CLIENTE:
- Intención: ${analysis.intencion}
- Claridad: ${analysis.claridad}
- Tipo: ${analysis.tipo_cliente}
- Urgencia: ${analysis.urgencia}
- Tipo solicitud: ${analysis.tipo_servicio}

🧭 ESTRATEGIA:
${tipoFlow}

⚡ URGENCIA:
${urgenciaFlow}

Mensaje del cliente:
"${userMessage}"

Responde como asesor de ventas experto.
`;


    // Filtrar y mapear conversationHistory para asegurar que content sea string
    const safeHistory = Array.isArray(conversationHistory)
      ? conversationHistory
        .filter(msg => msg && typeof msg.content === 'string')
        .map(msg => ({ ...msg, content: String(msg.content) }))
      : [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: finalPrompt },
        ...safeHistory,
        { role: 'user', content: userMessage }
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.error('❌ Error respuesta:', error);
    return 'Ocurrió un error al generar la respuesta.';
  }
}/**
 * ============================
 * 🤖 EXTRAER DATOS CON IA
 * ============================
 */
export async function detectAndExtractReservationData(userMessage, conversationHistory = []) {
  try {
    const openai = getOpenAIInstance();

    const historyText = conversationHistory
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const prompt = `
Analiza si el usuario EXPLÍCITAMENTE quiere agendar una visita técnica.

FECHA HOY: ${todayStr}
MAÑANA: ${tomorrowStr}

HORARIO DE ATENCIÓN: 9 AM a 7 PM
BLOQUES DE 1 HORA: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00

Mensaje: "${userMessage}"

Contexto:
${historyText}

Responde SOLO JSON:

{
  "shouldReserve": true/false,
  "confidence": 0.0-1.0,
  "clientName": "string|null",
  "clientPhone": "string|null",
  "clientEmail": "string|null",
  "serviceType": "string|null",
  "city": "Ciudad de México|null",
  "address": "string|null",
  "preferredDate": "YYYY-MM-DD|null",
  "preferredTime": "HH:mm|null (SOLO bloques: 09:00, 10:00, 11:00, ... 19:00)",
  "notes": "string|null"
}

REGLAS CRÍTICAS PARA shouldReserve = true:
- El usuario DEBE DECIR EXPLÍCITAMENTE una de estas frases:
  * "Quiero una visita"
  * "Agendar una cita"
  * "Reservar para [fecha]"
  * "¿Cuándo pueden venir?"
  * "Necesito que vengan"
  * "Agende una visita"
  
- ADEMÁS, debe incluir AL MENOS 2 de estos datos:
  * Nombre completo
  * Teléfono
  * Dirección/ubicación específica
  * Fecha o franja horaria clara
  * Tipo de servicio concreto

FRASES QUE NO SON SOLICITUD DE RESERVACIÓN:
- "Busco un servicio" → Solo clasificación
- "¿Qué servicios ofrecen?" → Solo información
- "Necesito ayuda con..." → Diagnóstico inicial
- "No tengo presupuesto" → Objeción
- "Me interesa pero..." → Interés pero no confirmado

IMPORTANTE:
- NO ASUMAS contexto
- Si NO hay mínimo 2 datos concretos → shouldReserve = false
- Si NO hay frase explícita de agendamiento → shouldReserve = false
- Solo cuando confidence >= 0.8 Y tengas al menos 2 datos concretos → shouldReserve = true

CONVERSIÓN DE HORARIOS:
- "mañana" → ${tomorrowStr}
- "2 PM" → 14:00 (en bloques de hora exacta)
- "tarde" → No asumas, solo extrae si es específico (ej: 14:00, 15:00)
- La hora DEBE estar entre 9 AM (09:00) y 7 PM (19:00)
- SOLO bloques de 1 hora: 09:00, 10:00, 11:00, ... 19:00
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Responde SOLO JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    });

    let text = completion.choices[0].message.content.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    if (!text.startsWith('{')) throw new Error('No JSON');

    return JSON.parse(text);

  } catch (error) {
    console.error('❌ Error IA:', error);
    return { shouldReserve: false };
  }
}
export async function generateNotesWithAI(conversationHistory) {
  try {
    const formattedHistory = conversationHistory
      .slice(-10) // 🔥 optimización
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
      .join('\n');

    const prompt = `
Analiza la conversación y genera un resumen en UNA SOLA LÍNEA.

Formato:
Cliente - servicio - problema - ubicación - urgencia

Ejemplo:
Juan Pérez - reparación de ventana - filtración de agua - Roma Norte CDMX - media

Reglas:
- Máximo 15 palabras
- Sin saltos de línea
- Sin etiquetas
- No inventes información

Conversación:
${formattedHistory}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Resumes conversaciones de forma ultra breve." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    });

    let text = response.choices[0].message.content || '';

    // 🔥 asegurar una sola línea SIEMPRE
    return text.replace(/\n/g, ' ').slice(0, 120).trim();
  } catch (error) {
    console.error('❌ Error generando notes:', error);
    return '';
  }
}
/**
 * ============================
 * 🔐 VALIDAR Y FORMATEAR DATOS
 * ============================
 * Valida y formatea datos de reservación antes de ser guardados
 */
export function validateAndFormatReservationData(data, existingAppointments = []) {
  try {
    console.log('🔐 Iniciando validación de datos de reservación:', data);

    // ✅ 1. Validar que sea Ciudad de México
    console.log('🌍 Verificando localización...');
    if (!data.city) {
      console.warn('⚠️ Falta información de la ciudad');
      return {
        valid: false,
        error: '❌ Necesito saber en qué ciudad es el servicio. ¿Es en la Ciudad de México (CDMX)?',
        missingData: ['Ciudad']
      };
    }

    const cityNormalized = data.city.toLowerCase().trim();
    const isValidCity = cityNormalized.includes('cdmx') ||
      cityNormalized.includes('ciudad de méxico') ||
      cityNormalized.includes('mexico city');

    if (!isValidCity) {
      console.warn(`❌ Ciudad no permitida: ${data.city}`);
      return {
        valid: false,
        error: `⚠️ Por ahora solo atendemos servicios en la Ciudad de México (CDMX). Mencionaste: ${data.city}. ¿Tu ubicación está en CDMX?`,
      };
    }
    console.log('✅ Ciudad validada: CDMX ✓');

    // ✅ 2. Validar nombre del cliente
    console.log('👤 Validando nombre...');
    if (!data.clientName || data.clientName.trim().length === 0) {
      console.warn('⚠️ Falta nombre del cliente');
      return {
        valid: false,
        error: '❌ Necesito tu nombre completo para la reservación',
        missingData: ['Nombre completo']
      };
    }
    console.log('✅ Nombre validado:', data.clientName);

    // ✅ 3. Validar tipo de servicio
    console.log('🔧 Validando tipo de servicio...');
    if (!data.serviceType || data.serviceType.trim().length === 0) {
      console.warn('⚠️ Falta tipo de servicio');
      return {
        valid: false,
        error: '❌ ¿Qué tipo de servicio necesitas? (instalación, reparación, diagnóstico, etc.)',
        missingData: ['Tipo de servicio']
      };
    }
    console.log('✅ Servicio validado:', data.serviceType);

    // ✅ 4. Validar dirección (CRÍTICA - debe ser específica)
    console.log('🏠 Validando dirección...');
    if (!data.address || data.address.trim().length < 5) {
      console.warn('⚠️ Dirección insuficiente:', data.address);
      return {
        valid: false,
        error: '❌ Necesito una dirección específica. Por favor incluye: calle, número, colonia y delegación.',
        missingData: ['Dirección específica']
      };
    }
    // 📝 Validar notes (OPCIONAL)
    console.log('📝 Validando notes...');

    let notes = '';

    if (typeof data.notes === 'string') {
      notes = data.notes
        .replace(/\s+/g, ' ')   // limpia espacios y saltos
        .trim()
        .slice(0, 150);        // límite duro
    }

    // 🔥 FILTROS DE CALIDAD
    if (notes.length < 10) {
      notes = '';
    }

    // ❌ frases basura
    const genericPhrases = [
      'sin información',
      'no especificado',
      'no disponible',
      'cliente solicita información',
      'n/a'
    ];

    if (genericPhrases.some(p => notes.toLowerCase().includes(p))) {
      notes = '';
    }

    // ✅ asignación final segura
    data.notes = notes;
    // Detectar direcciones vagas
    const vaguePhrases = ['en mi casa', 'en el trabajo', 'en casa', 'aqui', 'ahi', 'en el local', 'en mi lugar'];
    const addressLower = data.address.toLowerCase().trim();

    if (vaguePhrases.some(phrase => addressLower.includes(phrase)) || addressLower.split(' ').length < 3) {
      console.warn('⚠️ Dirección muy vaga:', data.address);
      return {
        valid: false,
        error: `❌ La dirección "${data.address}" es demasiado vaga. Necesito: **calle, número, colonia y delegación** (ej: "Avenida Paseo de la Reforma 505, Cuauhtémoc")`,
        missingData: ['Dirección específica con calle, número, colonia y delegación']
      };
    }

    console.log('✅ Dirección validada:', data.address);

    // ✅ 5. Validar que la fecha y hora estén disponibles
    console.log('📅 Validando fecha y hora...');
    if (!data.preferredDate || !data.preferredTime) {
      console.warn('⚠️ Faltan datos de fecha/hora:', { date: data.preferredDate, time: data.preferredTime });
      return {
        valid: false,
        error: '❌ Necesito saber cuándo deseas el servicio. Por favor especifica una fecha y hora.',
        missingData: [
          !data.preferredDate ? '📅 Fecha preferida (ej: 2026-04-22)' : '',
          !data.preferredTime ? '⏰ Hora preferida (ej: 14:00)' : ''
        ].filter(x => x)
      };
    }

    // ✅ 6. Parsear y validar fecha y hora
    let dateTime = null;
    try {
      console.log(`📅 Parseando fecha: ${data.preferredDate} y hora: ${data.preferredTime}`);

      // ⚠️ IMPORTANTE: Parsear la fecha en zona horaria LOCAL, no en UTC
      const [year, month, day] = data.preferredDate.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      // Validar que la fecha sea válida
      if (isNaN(date.getTime())) {
        throw new Error('Formato de fecha inválido. Debe ser YYYY-MM-DD');
      }

      const [hours, minutes] = data.preferredTime.split(':');
      const parsedHours = parseInt(hours);
      const parsedMinutes = parseInt(minutes);

      console.log(`⏰ Horas: ${parsedHours}, Minutos: ${parsedMinutes}`);

      // ✅ NUEVA VALIDACIÓN: Solo bloques de 1 hora (minutos = 00)
      if (parsedMinutes !== 0) {
        console.warn('⚠️ Minutos no son 00:', parsedMinutes);
        throw new Error(`Las citas deben ser en bloques de 1 hora exacta (9:00, 10:00, etc.). No se permiten horarios como ${parsedHours}:${String(parsedMinutes).padStart(2, '0')}`);
      }

      // ✅ NUEVA VALIDACIÓN: Horario de atención 9 AM a 7 PM
      if (parsedHours < 9 || parsedHours > 19) {
        console.warn('⚠️ Hora fuera del horario de atención:', parsedHours);
        const availableHours = '9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00';
        throw new Error(`El horario de atención es de 9:00 AM a 7:00 PM. Horarios disponibles: ${availableHours}`);
      }

      // Validar horas y minutos
      if (isNaN(parsedHours) || isNaN(parsedMinutes) || parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) {
        throw new Error('Hora inválida: debe ser HH:mm en formato 24 horas (ej: 14:00)');
      }

      date.setHours(parsedHours, parsedMinutes, 0, 0);
      dateTime = date;

      console.log(`✅ Fecha/hora parseada correctamente: ${dateTime.toISOString()}`);

      // Validar que la fecha no esté en el pasado (normalizando a minutos exactos)
      const now = new Date();
      const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
      if (dateTime.getTime() <= nowNormalized.getTime()) {
        console.warn(`⚠️ Fecha en el pasado: ${dateTime} <= ${nowNormalized}`);
        // Sugerir próxima hora disponible de hoy o de mañana
        let suggestedDateTime = null;
        let suggestedStr = '';
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        let nextHour = now.getHours() + 1;
        // Si ya pasó el horario de atención hoy, sugerir primer bloque de mañana
        if (nextHour > 19) {
          // Mañana a las 9:00
          const tomorrow = new Date(currentYear, currentMonth, currentDay + 1, 9, 0, 0, 0);
          suggestedDateTime = tomorrow;
          suggestedStr = `mañana a las 09:00`;
        } else if (nextHour < 9) {
          // Hoy a las 9:00
          const todayMorning = new Date(currentYear, currentMonth, currentDay, 9, 0, 0, 0);
          suggestedDateTime = todayMorning;
          suggestedStr = `hoy a las 09:00`;
        } else {
          // Hoy a la siguiente hora disponible
          const todayNext = new Date(currentYear, currentMonth, currentDay, nextHour, 0, 0, 0);
          // Si la hora sugerida ya pasó por minutos, sumar otra hora
          if (todayNext <= nowNormalized) {
            todayNext.setHours(todayNext.getHours() + 1);
          }
          // Si ya no hay bloques hoy, sugerir mañana a las 9:00
          if (todayNext.getHours() > 19) {
            const tomorrow = new Date(currentYear, currentMonth, currentDay + 1, 9, 0, 0, 0);
            suggestedDateTime = tomorrow;
            suggestedStr = `mañana a las 09:00`;
          } else {
            suggestedDateTime = todayNext;
            suggestedStr = `hoy a las ${String(todayNext.getHours()).padStart(2, '0')}:00`;
          }
        }
        return {
          valid: false,
          error: `❌ La fecha y hora que especificaste ya pasaron. Te propongo: ${suggestedStr}. ¿Te funciona ese horario?`,
          suggestedDateTime: suggestedDateTime.toISOString(),
        };
      }

    } catch (error) {
      console.error('❌ Error parseando fecha/hora:', error);
      return {
        valid: false,
        error: `❌ ${error.message}`,
      };
    }

    // ✅ 7. NUEVA VALIDACIÓN: Verificar que no exista otra cita en la misma hora
    console.log('🔄 Verificando disponibilidad de horario...');
    if (existingAppointments && existingAppointments.length > 0) {
      const BUFFER = 60 * 60 * 1000; // 1 hora de buffer
      const requestedTime = dateTime.getTime();

      const conflictingAppointment = existingAppointments.find(appt => {
        const existingTime = new Date(appt.dateTime).getTime();
        const timeDifference = Math.abs(existingTime - requestedTime);
        return timeDifference < BUFFER;
      });

      if (conflictingAppointment) {
        console.warn('❌ Horario ocupado:', {
          solicitado: dateTime.toLocaleString('es-MX'),
          existente: new Date(conflictingAppointment.dateTime).toLocaleString('es-MX')
        });

        // Sugerir próximo horario disponible (solo bloques válidos entre 9-19)
        let suggestedTime = new Date(dateTime);
        let found = false;

        for (let i = 1; i <= 10; i++) {
          suggestedTime.setHours(suggestedTime.getHours() + 1);

          // Solo considerar si está dentro del horario 9-19
          if (suggestedTime.getHours() < 9 || suggestedTime.getHours() > 19) {
            continue;
          }

          const suggestedTimeMs = suggestedTime.getTime();

          const isAvailable = !existingAppointments.some(appt => {
            const existingTime = new Date(appt.dateTime).getTime();
            return Math.abs(existingTime - suggestedTimeMs) < BUFFER;
          });

          if (isAvailable) {
            found = true;
            break;
          }
        }

        const suggestedTimeStr = found
          ? suggestedTime.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
          : 'próximamente';

        return {
          valid: false,
          error: `⚠️ Ese horario ya está ocupado.\n\nTe propongo: ${suggestedTimeStr}\n\n¿Te funciona ese horario?`,
          conflict: true,
          suggestedDateTime: found ? suggestedTime.toISOString() : null
        };
      }

      console.log('✅ Horario disponible ✓');
    }

    console.log('✅ TODAS LAS VALIDACIONES PASARON');
    return {
      valid: true,
      formatted: {
        clientName: data.clientName,
        clientPhone: data.clientPhone || '',
        clientEmail: data.clientEmail || '',
        serviceType: data.serviceType,
        address: data.address,
        city: data.city,
        dateTime: dateTime.toISOString(),
        notes: data.notes || '',
        duration: 60, // Duración por defecto
      },
    };
  } catch (error) {
    console.error('❌ Error validando datos de reservación:', error);
    return {
      valid: false,
      error: error.message,
    };
  }
}

// Alias para compatibilidad
export const validateReservationData = validateAndFormatReservationData;

/**
 * ============================
 * ⏱️ VALIDAR DISPONIBILIDAD
 * ============================
 */
function isTimeSlotAvailable(dateTime, existingAppointments = []) {
  const requested = new Date(dateTime).getTime();
  const BUFFER = 60 * 60 * 1000;

  return !existingAppointments.some(appt => {
    const existing = new Date(appt.dateTime).getTime();
    return Math.abs(existing - requested) < BUFFER;
  });
}

/**
 * ============================
 * 🔁 SUGERIR NUEVO HORARIO
 * ============================
 */
function suggestNextAvailableSlot(dateTime, existingAppointments = []) {
  let newDate = new Date(dateTime);

  for (let i = 1; i <= 5; i++) {
    newDate.setHours(newDate.getHours() + 1);

    if (isTimeSlotAvailable(newDate, existingAppointments)) {
      return newDate;
    }
  }

  return null;
}

/**
 * ============================
 * 💬 MENSAJES
 * ============================
 */
function formatDate(date) {
  return date.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function buildSuccessMessage(appt) {
  return `✅ ¡Cita confirmada!

📅 ${formatDate(new Date(appt.dateTime))}
📍 ${appt.address}

¡Te esperamos! 🛠️`;
}

function buildConflictMessage(original, newSlot) {
  return `⚠️ Ese horario ya está ocupado.

📅 Tu solicitud: ${formatDate(new Date(original.dateTime))}

Te propongo:
👉 ${formatDate(newSlot)}

¿Te funciona ese horario? 😊`;
}

/**
 * ============================
 * 🎯 FLUJO PRINCIPAL
 * ============================
 */
export async function processReservation(userMessage, history, existingAppointments = []) {
  // 1. Extraer datos
  const data = await detectAndExtractReservationData(userMessage, history);

  // 2. Validar (ahora con validación de disponibilidad de horario)
  const validation = validateAndFormatReservationData(data, existingAppointments);

  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
      missingData: validation.missingData || [],
      conflict: validation.conflict || false,
      suggestedDateTime: validation.suggestedDateTime || null
    };
  }

  const appointment = validation.formatted;

  // 3. Confirmar
  return {
    success: true,
    appointment,
    message: `✅ ¡Cita confirmada!\n\n📅 ${new Date(appointment.dateTime).toLocaleString('es-MX')}\n📍 ${appointment.address}\n\n¡Te esperamos! 🛠️`
  };
}

