import { generateAIResponse } from '../services/ai.service.js';
import { validateAndFormatReservationData } from '../services/ai.service.js';
import { createReservation } from '../services/reservation.service.js';
import {
  getConversationHistory,
  saveMessageToHistory,
  formatHistoryForOpenAI,
  clearConversationHistory
} from '../services/conversation.service.js';

export const chatWithAI = async (req, res) => {
  const { message, history, userId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  // Usar userId del body o generar uno por defecto para Postman
  const userIdentifier = userId || 'postman-user-default';

  try {
    // 💾 Guardar mensaje del usuario
    await saveMessageToHistory(userIdentifier, 'user', message);

    // 📚 Obtener historial (si no se envía, recuperar del archivo)
    let conversationHistory;
    if (history) {
      // Si se envía historial manualmente
      conversationHistory = history;
    } else {
      // Recuperar del archivo guardado
      const savedHistory = await getConversationHistory(userIdentifier);
      conversationHistory = formatHistoryForOpenAI(savedHistory);
    }

    // 🤖 Generar respuesta
    const aiResponse = await generateAIResponse({
      userMessage: message,
      conversationHistory: conversationHistory,
    });

    console.log('📤 Respuesta de IA recibida:');
    console.log('   - Tipo:', typeof aiResponse);
    console.log('   - Es objeto:', typeof aiResponse === 'object');
    console.log('   - Tiene reservationRequest:', aiResponse?.reservationRequest);
    console.log('   - Contenido:', JSON.stringify(aiResponse, null, 2).substring(0, 500));

    // Extraer respuesta y datos de reservación si existen
    let response = aiResponse;
    let reservationResult = null;

    if (typeof aiResponse === 'object' && aiResponse.reservationRequest) {
      console.log('🔄 Procesando solicitud de reservación');
      response = aiResponse.reply;
      
      // 📅 Procesar solicitud de reservación
      if (aiResponse.reservationData && aiResponse.reservationData.shouldReserve) {
        console.log('✅ shouldReserve es true, validando datos...');
        const validation = validateAndFormatReservationData(aiResponse.reservationData);
        console.log('📝 Resultado de validación:', validation);
        
        if (validation.valid) {
          console.log('✅ Validación exitosa, creando reservación...');
          reservationResult = await createReservation({
            userId: userIdentifier,
            ...validation.formatted,
          });
          console.log('📅 Resultado de creación:', reservationResult);

          if (reservationResult.success) {
            console.log('🎉 ¡Reservación creada exitosamente!');
            response += `\n\n✅ *RESERVACIÓN CONFIRMADA*\n`;
            response += `📅 Fecha: ${new Date(reservationResult.reservation.dateTime).toLocaleDateString('es-MX')}\n`;
            response += `⏰ Hora: ${new Date(reservationResult.reservation.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
            response += `📍 Ubicación: ${reservationResult.reservation.address}\n`;
            response += `🔗 Link: ${reservationResult.eventLink}`;
          } else {
            console.error('❌ Error creando reservación:', reservationResult.error);
            response += `\n\n❌ *No se pudo crear la reservación*\n`;
            response += `Error: ${reservationResult.error}`;
          }
        } else {
          console.warn('⚠️ Validación falló:', validation.error);
          // Validación falló - mostrar error al usuario
          response += `\n\n⚠️ *No se pudo completar la reservación*\n`;
          response += `Problema: ${validation.error}\n`;
          
          if (validation.missingData && validation.missingData.length > 0) {
            response += `\nNecesito que me proporciones:\n`;
            validation.missingData.forEach((item, index) => {
              response += `${index + 1}. ${item}\n`;
            });
          }
        }
      } else if (aiResponse.reservationData && aiResponse.reservationData.missingData && aiResponse.reservationData.missingData.length > 0) {
        response += `\n\n📋 Para completar tu reservación, necesito que me proporciones:\n`;
        aiResponse.reservationData.missingData.forEach((item, index) => {
          response += `${index + 1}. ${item}\n`;
        });
      }
    }

    // 💾 Guardar respuesta de la IA
    await saveMessageToHistory(userIdentifier, 'assistant', response);

    res.json({
      reply: response,
      userId: userIdentifier,
      historySize: conversationHistory.length,
      reservation: reservationResult ? {
        success: reservationResult.success,
        eventId: reservationResult.eventId,
        eventLink: reservationResult.eventLink,
      } : null,
    });
  } catch (error) {
    console.error('❌ Error en Chat Controller:', error);
    res.status(500).json({
      error: 'Error al procesar el mensaje',
      details: error.message,
    });
  }
};

// Endpoint para obtener historial
export const getHistory = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    const history = await getConversationHistory(userId);
    res.json({
      userId,
      messages: history,
      totalMessages: history.length,
    });
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({
      error: 'Error al obtener el historial',
      details: error.message,
    });
  }
};

// Endpoint para limpiar historial
export const clearHistory = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId requerido' });
  }

  try {
    await clearConversationHistory(userId);
    res.json({
      message: 'Historial limpiado correctamente',
      userId,
    });
  } catch (error) {
    console.error('❌ Error limpiando historial:', error);
    res.status(500).json({
      error: 'Error al limpiar el historial',
      details: error.message,
    });
  }
};
