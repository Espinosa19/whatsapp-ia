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
    // 🤖 3. Generar respuesta inteligente
    const response = await generateContextualResponse({
      userMessage,
      conversationHistory,
      systemPrompt,
      analysis
    });
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

    const text = completion.choices[0].message.content.trim();

    try {
      return JSON.parse(text);
    } catch {
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