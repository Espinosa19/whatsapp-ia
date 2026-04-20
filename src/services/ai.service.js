import fs from 'fs/promises';
import path from 'path';
import { getOpenAIInstance } from '../config/openai.config.js';

export async function generateAIResponse({ userMessage, conversationHistory = [] }) {
  try {

    // 📥 1. Leer prompt base (tu negocio)
    const promptPath = path.resolve('src/prompts/assistant.txt');
    const systemPrompt = await fs.readFile(promptPath, 'utf-8');

    // 🧠 2. Analizar mensaje
    const analysis = await analyzeUserMessage(userMessage);
    console.log('📊 Análisis:', analysis);

    // 📅 3. Detectar si es solicitud de reservación
    let reservationData = null;
    if (analysis.tipo_servicio === 'servicio') {
      console.log('🔍 Tipo de servicio detectado, extrayendo datos de reservación...');
      reservationData = await detectAndExtractReservationData(userMessage, conversationHistory);
      console.log('📋 Datos de reservación extraídos:', JSON.stringify(reservationData, null, 2));
      console.log('📋 shouldReserve =', reservationData?.shouldReserve);
      
      // Si falta información pero es una solicitud clara
      if (reservationData && !reservationData.shouldReserve && reservationData.missingData?.length > 0) {
        console.log('⚠️ Reservación incompleta, pidiendo datos faltantes:', reservationData.missingData);
        
        // Generar respuesta pidiendo datos específicos
        const missingDataText = reservationData.missingData
          .map((item, idx) => `${idx + 1}. ${item}`)
          .join('\n');
          
        const incompleteResponse = `
Para poder agendar tu visita técnica, necesito que me proporciones la siguiente información:

${missingDataText}

¿Puedes decirme estos datos? 😊
`;
        return incompleteResponse;
      }
    } else {
      console.log('ℹ️ Tipo de servicio NO es "servicio", es:', analysis.tipo_servicio);
    }

    // 🤖 4. Generar respuesta inteligente
    const response = await generateContextualResponse({
      userMessage,
      conversationHistory,
      systemPrompt,
      analysis
    });

    // Retornar respuesta con información de reservación si aplica
    if (reservationData && reservationData.shouldReserve) {
      console.log('✅ Solicitud de reservación detectada y confirmada');
      return {
        reply: response,
        reservationRequest: true,
        reservationData: reservationData,
      };
    } else if (reservationData) {
      console.log('⚠️ reservationData existe pero shouldReserve es:', reservationData.shouldReserve);
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: finalPrompt },
        ...conversationHistory,
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
Analiza si el usuario quiere una visita técnica.

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

REGLAS:
- "mañana" → ${tomorrowStr}
- IMPORTANTE: La hora debe ser EXACTA en bloques de hora (09:00, 10:00, etc.)
- La hora DEBE estar entre 9 AM (09:00) y 7 PM (19:00)
- NO aceptar horarios como 14:30, 15:45, etc.
- Si el usuario dice "2 PM", convertir a 14:00
- Si dice "tarde", sugerir 14:00 o 15:00
- Detectar CDMX por CP o alcaldía
- Extraer nombre del contexto si no viene
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
      
      // Validar que la fecha no esté en el pasado
      const now = new Date();
      if (dateTime < now) {
        console.warn(`⚠️ Fecha en el pasado: ${dateTime} < ${now}`);
        return {
          valid: false,
          error: '❌ La fecha y hora que especificaste ya pasaron. Por favor elige una fecha futura.',
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