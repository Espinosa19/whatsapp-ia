import axios from 'axios';
import { generateAIResponse, validateAndFormatReservationData } from '../services/ai.service.js';
import { createReservation, getUserReservations } from '../services/reservation.service.js';
import { 
  getConversationHistory, 
  saveMessageToHistory,
  formatHistoryForOpenAI
} from '../services/conversation.service.js';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0/1381946793669697/messages';

export const verifyWebhook = (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

export const receiveMessage = async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return res.sendStatus(200);

    const message = messages[0];
    const from = message.from; // ID del usuario (número de WhatsApp)
    const text = message.text?.body;

    if (!text) return res.sendStatus(200);

    console.log('📩 Mensaje de', from, ':', text);

    // 💾 Guardar mensaje del usuario
    await saveMessageToHistory(from, 'user', text);

    // 📚 Obtener historial de conversación
    const history = await getConversationHistory(from);
    const formattedHistory = formatHistoryForOpenAI(history);

    // 🤖 Generar respuesta con historial completo
    const aiResponse = await generateAIResponse({
      userMessage: text,
      conversationHistory: formattedHistory,
    });

    console.log('📤 Respuesta de IA recibida en webhook:');
    console.log('   - Tipo:', typeof aiResponse);
    console.log('   - Es objeto:', typeof aiResponse === 'object');
    console.log('   - Tiene reservationRequest:', aiResponse?.reservationRequest);

    // Extraer respuesta y datos de reservación si existen
    let reply = aiResponse;
    let reservationResult = null;

    if (typeof aiResponse === 'object' && aiResponse.reservationRequest) {
      console.log('🔄 Procesando solicitud de reservación desde WhatsApp');
      reply = aiResponse.reply;
      
      // 📅 Procesar solicitud de reservación
      if (aiResponse.reservationData && aiResponse.reservationData.shouldReserve) {
        console.log('✅ shouldReserve es true, validando datos...');
        
        // Obtener citas existentes del usuario para validar disponibilidad
        const existingReservations = await getUserReservations(from);
        console.log(`📊 Citas existentes del usuario: ${existingReservations.length}`);
        
        const validation = validateAndFormatReservationData(
          aiResponse.reservationData,
          existingReservations
        );
        console.log('📝 Resultado de validación:', validation);
        
        if (validation.valid) {
          console.log('✅ Validación exitosa, creando reservación...');
          reservationResult = await createReservation({
            userId: from,
            ...validation.formatted,
          });
          console.log('📅 Resultado de creación:', reservationResult);

          if (reservationResult.success) {
            console.log('🎉 ¡Reservación creada exitosamente desde WhatsApp!');
            reply += `\n\n✅ *RESERVACIÓN CONFIRMADA*\n`;
            reply += `📅 Fecha: ${new Date(reservationResult.reservation.dateTime).toLocaleDateString('es-MX')}\n`;
            reply += `⏰ Hora: ${new Date(reservationResult.reservation.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
            reply += `📍 Ubicación: ${reservationResult.reservation.address}\n`;
            reply += `🔗 Link: ${reservationResult.eventLink}`;
          } else {
            console.error('❌ Error creando reservación:', reservationResult.error);
            reply += `\n\n❌ *No se pudo crear la reservación*\n`;
            reply += `Error: ${reservationResult.error}`;
          }
        } else {
          // ❌ VALIDACIÓN FALLÓ - No usar la respuesta de IA, solo mostrar el error
          console.warn('⚠️ Validación falló:', validation.error);
          // Reemplazar completamente la respuesta anterior con solo el error
          reply = validation.error;
          
          if (validation.missingData && validation.missingData.length > 0) {
            reply += `\n\nNecesito que me proporciones:\n`;
            validation.missingData.forEach((item, index) => {
              reply += `${index + 1}. ${item}\n`;
            });
          }
        }
      } else if (aiResponse.reservationData && aiResponse.reservationData.missingData && aiResponse.reservationData.missingData.length > 0) {
        reply += `\n\n📋 Para completar tu reservación, necesito que me proporciones:\n`;
        aiResponse.reservationData.missingData.forEach((item, index) => {
          reply += `${index + 1}. ${item}\n`;
        });
      }
    }
      

    // 💾 Guardar respuesta de la IA
    await saveMessageToHistory(from, 'assistant', reply);

    // 📤 Enviar respuesta a WhatsApp
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: reply },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error receiveMessage:', error.response?.data || error.message);
    res.sendStatus(500);
  }
};
