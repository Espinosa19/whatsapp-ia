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
    return 'Lo siento, ocurrió un error.';
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
}

/**
 * Detecta si el usuario quiere hacer una reservación de visita técnica
 * Extrae los datos necesarios del mensaje y el historial de conversación
 */
export async function detectAndExtractReservationData(userMessage, conversationHistory = []) {
  try {
    const openai = getOpenAIInstance();

    // Construir el historial de conversación para contexto
    const historyText = conversationHistory
      .slice(-4) // Últimos 4 mensajes
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Obtener fecha de hoy para cálculos de fechas relativas
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    today.setDate(today.getDate() + 1);
    const tomorrowStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const prompt = `
Analiza si el usuario está solicitando una visita técnica y extrae los datos.

FECHA ACTUAL: ${todayStr}
MAÑANA SERÍA: ${tomorrowStr}

Mensaje actual: "${userMessage}"

Contexto previo:
${historyText}

Responde SOLO en JSON con este formato:

{
  "shouldReserve": true/false,
  "confidence": 0.0-1.0,
  "clientName": "nombre del cliente o null",
  "clientPhone": "número telefónico o null",
  "clientEmail": "email o null",
  "serviceType": "instalación|reparación|diagnóstico|otro o null",
  "address": "dirección o null",
  "preferredDate": "YYYY-MM-DD o null",
  "preferredTime": "HH:mm o null",
  "notes": "notas adicionales o null",
  "missingData": ["lista de datos que faltan para completar la reservación"]
}

Reglas IMPORTANTES:
- shouldReserve = true solo si hay solicitud clara de visita técnica
- Confidence > 0.7 indica seguridad alta
- SIEMPRE retorna preferredDate en formato YYYY-MM-DD (nunca texto como "mañana")
- Si dice "mañana" → usar ${tomorrowStr}
- Si dice "próxima semana" → sumar 7 días a hoy
- Si dice "el miércoles" → calcular el próximo miércoles
- Si dice "esta tarde" → preferredTime = "14:00"
- Si dice "a las 10 AM" → preferredTime = "10:00"
- Si no está claro la hora, deja en null
- Extrae datos que están explícitos o pueden inferirse del contexto
- Si falta fecha u hora, agrega a missingData
- El teléfono debe ser solo números
- El email debe ser válido
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres experto en extracción de datos de conversaciones. SIEMPRE retorna fechas en formato YYYY-MM-DD, nunca texto.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 400,
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
      
      const data = JSON.parse(text);
      console.log('📅 Análisis de reservación:', data);
      return data;
    } catch (parseError) {
      console.warn('⚠️ No se pudo parsear la respuesta de reservación:', text);
      console.error('Error al parsear:', parseError.message);
      return { shouldReserve: false };
    }

  } catch (error) {
    console.error('❌ Error detectando reservación:', error);
    return { shouldReserve: false };
  }
}

/**
 * Valida y formatea datos de reservación antes de ser guardados
 */
export function validateAndFormatReservationData(data) {
  try {
    console.log('🔐 Iniciando validación de datos de reservación:', data);
    
    // Validar datos requeridos
    if (!data.clientName || !data.serviceType || !data.address) {
      console.warn('⚠️ Faltan datos requeridos');
      return {
        valid: false,
        error: 'Faltan datos requeridos: clientName, serviceType, address',
      };
    }

    // Validar que la fecha y hora estén disponibles
    if (!data.preferredDate || !data.preferredTime) {
      console.warn('⚠️ Faltan datos de fecha/hora:', { date: data.preferredDate, time: data.preferredTime });
      return {
        valid: false,
        error: 'Faltan datos de fecha/hora para la reservación',
        missingData: [
          !data.preferredDate ? 'Fecha preferida' : '',
          !data.preferredTime ? 'Hora preferida' : ''
        ].filter(x => x)
      };
    }

    // Parsear fecha y hora
    let dateTime = null;
    try {
      console.log(`📅 Parseando fecha: ${data.preferredDate} y hora: ${data.preferredTime}`);
      
      // ⚠️ IMPORTANTE: Parsear la fecha en zona horaria LOCAL, no en UTC
      // Esto evita problemas con desplazamientos de zona horaria
      const [year, month, day] = data.preferredDate.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Validar que la fecha sea válida
      if (isNaN(date.getTime())) {
        throw new Error('Fecha inválida');
      }
      
      const [hours, minutes] = data.preferredTime.split(':');
      const parsedHours = parseInt(hours);
      const parsedMinutes = parseInt(minutes);
      
      console.log(`⏰ Horas: ${parsedHours}, Minutos: ${parsedMinutes}`);
      
      // Validar horas y minutos
      if (isNaN(parsedHours) || isNaN(parsedMinutes) || parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) {
        throw new Error('Hora inválida: debe ser HH:mm en formato 24 horas');
      }
      
      date.setHours(parsedHours, parsedMinutes, 0, 0);
      dateTime = date;
      
      console.log(`✅ Fecha/hora parseada: ${dateTime.toISOString()}`);
      
      // Validar que la fecha no esté en el pasado
      const now = new Date();
      if (dateTime < now) {
        console.warn(`⚠️ Fecha en el pasado: ${dateTime} < ${now}`);
        return {
          valid: false,
          error: 'La fecha/hora no puede ser en el pasado',
        };
      }
      
    } catch (error) {
      console.error('❌ Error parseando fecha/hora:', error);
      return {
        valid: false,
        error: `Formato de fecha/hora inválido: ${error.message}. Usa YYYY-MM-DD para fecha y HH:mm para hora`,
      };
    }

    return {
      valid: true,
      formatted: {
        clientName: data.clientName,
        clientPhone: data.clientPhone || '',
        clientEmail: data.clientEmail || '',
        serviceType: data.serviceType,
        address: data.address,
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