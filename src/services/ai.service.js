import fs from 'fs/promises';
import path from 'path';
import { getOpenAIInstance } from '../config/openai.config.js';
import { getRedisClient } from '../config/redis.config.js';
import { createGoogleCalendarEvent } from '../services/google-calendar.service.js';
export async function generateAIResponse({ userMessage, conversationHistory = [], userId }) {
  try {
    const promptPath = path.resolve('src/prompts/assistant.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    const analysis = await analyzeUserMessage(userMessage);
    console.log('📊 Análisis:', analysis);

    const redis = await getRedisClient();

    const clientNameKey = userId ? `clientName_temp:${userId}` : null;
    const clientEmailKey = userId ? `clientEmail_temp:${userId}` : null;
    const addressKey = userId ? `address_temp:${userId}` : null;

    // 🔍 DETECCIONES
    let detectedName = null;
    let detectedEmail = null;
    let detectedAddress = null;
    let isBusiness = false;

    // Nombre
    const nameMatch = userMessage.match(/(mi nombre es|soy|me llamo)\s+([a-záéíóúüñ\s]+)/i);
    if (nameMatch) detectedName = nameMatch[2].trim();

    // Empresa
    if (/empresa|negocio|represento a/i.test(userMessage)) {
      isBusiness = true;
    }

    // Email
    const emailMatch = userMessage.match(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
    if (emailMatch) detectedEmail = emailMatch[1];

    // Dirección
    const addressMatch = userMessage.match(/((calle|av\.?|avenida|colonia|delegación|numero|número|cp|c\.p\.|manzana|lote|edificio|departamento|#)\s*[^.,\n]*)/i);
    if (addressMatch) detectedAddress = addressMatch[0].trim();

    // 💾 GUARDAR EN REDIS
    if (clientNameKey && detectedName) {
      const exists = await redis.get(clientNameKey);
      if (!exists) await redis.setEx(clientNameKey, 3600, detectedName);
    }

    if (clientEmailKey && detectedEmail) {
      const exists = await redis.get(clientEmailKey);
      if (!exists) await redis.setEx(clientEmailKey, 3600, detectedEmail);
    }

    if (addressKey && detectedAddress) {
      const exists = await redis.get(addressKey);
      if (!exists) await redis.setEx(addressKey, 3600, detectedAddress);
    }

    // 🔥 RECUPERAR DATOS
    const clientName = clientNameKey ? await redis.get(clientNameKey) : null;
    const clientEmail = clientEmailKey ? await redis.get(clientEmailKey) : null;
    const address = addressKey ? await redis.get(addressKey) : null;

    // 🧠 RESERVACIÓN
    let reservationData = null;

    if (analysis.tipo_servicio === 'servicio') {
      reservationData = await detectAndExtractReservationData(userMessage, conversationHistory);

      if (reservationData) {

        // 🛡️ NORMALIZAR ESTRUCTURA (CLAVE)
        reservationData = {
          missingData: [],
          shouldReserve: false,
          ...reservationData
        };

        if (!Array.isArray(reservationData.missingData)) {
          reservationData.missingData = [];
        }

        // ✅ ASIGNAR DATOS GLOBALES
        if (clientName) reservationData.clientName = clientName;
        if (clientEmail) reservationData.clientEmail = clientEmail;
        if (address) reservationData.address = address;

        // 🚫 NUNCA PEDIR NOMBRE
        reservationData.missingData = reservationData.missingData.filter(
          x => x !== 'Nombre completo'
        );

        // 🚨 VALIDACIÓN DE DATOS FALTANTES (dirección, fecha, hora, etc)
        const hasAddress = reservationData.address && reservationData.address.trim().length > 10;
        const hasDate = reservationData.preferredDate && reservationData.preferredDate.length === 10;
        const hasTime = reservationData.preferredTime && reservationData.preferredTime.length >= 4;

        // Asegurar que los campos críticos estén en missingData si faltan
        if (!hasAddress && !reservationData.missingData.includes('Dirección específica')) {
          reservationData.missingData.push('Dirección específica');
        }
        if (!hasDate && !reservationData.missingData.includes('📅 Fecha preferida (ej: 2026-04-22)')) {
          reservationData.missingData.push('📅 Fecha preferida (ej: 2026-04-22)');
        }
        if (!hasTime && !reservationData.missingData.includes('⏰ Hora preferida (ej: 14:00)')) {
          reservationData.missingData.push('⏰ Hora preferida (ej: 14:00)');
        }

        // Autocompletar correo si ya lo tenemos
        if (clientEmail && reservationData.missingData.includes('Correo electrónico')) {
          reservationData.missingData = reservationData.missingData.filter(x => x !== 'Correo electrónico');
        }

        // Si ya tenemos dirección, eliminar cualquier variante de dirección de missingData
        if (hasAddress) {
          reservationData.missingData = reservationData.missingData.filter(
            x => !x.toLowerCase().includes('dirección')
          );
        }
        // Si ya tenemos fecha, eliminar cualquier variante de fecha de missingData
        if (hasDate) {
          reservationData.missingData = reservationData.missingData.filter(
            x => !x.toLowerCase().includes('fecha')
          );
        }
        // Si ya tenemos hora, eliminar cualquier variante de hora de missingData
        if (hasTime) {
          reservationData.missingData = reservationData.missingData.filter(
            x => !x.toLowerCase().includes('hora')
          );
        }

        // 🔒 VALIDACIÓN FINAL (DOBLE SEGURO)
        if (reservationData.missingData.length === 0 && hasAddress && hasDate && hasTime) {
          reservationData.shouldReserve = true;
        } else {
          reservationData.shouldReserve = false;
        }

        // 📩 PEDIR DATOS FALTANTES
        if (!reservationData.shouldReserve && reservationData.missingData.length > 0) {
          const missingDataText = reservationData.missingData
            .map((item, idx) => `${idx + 1}. ${item}`)
            .join('\n');

          let extra = '';
          if (isBusiness && reservationData.missingData.includes('Correo electrónico')) {
            extra = '\nComo representas a una empresa, ¿podrías proporcionarme un correo electrónico de contacto?';
          }

          return `
Para poder agendar tu visita técnica, necesito:

${missingDataText}${extra}

¿Me apoyas con estos datos? 😊
(La dirección debe incluir calle, número, colonia y delegación)
`;
        }
      }
    }

    // 🤖 RESPUESTA IA
    const response = await generateContextualResponse({
      userMessage,
      conversationHistory,
      systemPrompt,
      analysis
    });


    // ✅ RESPUESTA FINAL: Intentar agendar en Google Calendar
    if (reservationData && reservationData.shouldReserve) {
      try {
        // Llamar a la función que agenda la cita en Google Calendar
        const calendarResult = await createGoogleCalendarEvent(reservationData);
        if (calendarResult && calendarResult.success) {
          // Confirmar al usuario con detalles de la cita
          return {
            reply: `✅ ¡Tu cita ha sido agendada exitosamente para el ${reservationData.preferredDate} a las ${reservationData.preferredTime}!\n\n${calendarResult.message || ''}`,
            reservationRequest: true,
            reservationData,
            calendarEvent: calendarResult.event || null
          };
        } else {
          // Error al agendar
          return {
            reply: `❌ Ocurrió un error al agendar tu cita en el calendario. ${calendarResult && calendarResult.message ? calendarResult.message : 'Por favor intenta de nuevo más tarde.'}`,
            reservationRequest: false,
            reservationData
          };
        }
      } catch (calendarError) {
        console.error('❌ Error al agendar en Google Calendar:', calendarError);
        return {
          reply: '❌ Ocurrió un error inesperado al intentar agendar tu cita en el calendario. Por favor intenta de nuevo más tarde.',
          reservationRequest: false,
          reservationData
        };
      }
    }

    return response;

  } catch (error) {
    console.error('❌ Error IA:', error);
    return 'Lo siento, ocurrió un error. Por favor intenta de nuevo.';
  }
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
  analysis
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