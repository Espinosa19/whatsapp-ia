
import { generateAIResponse } from '../services/ai.service.js';
import { validateAndFormatReservationData,generateNotesWithAI } from '../services/ai.service.js';
import { createReservation, getUserReservations } from '../services/reservation.service.js';
import {
  getConversationHistory,
  saveMessageToHistory,
  formatHistoryForOpenAI,
  clearConversationHistory
} from '../services/conversation.service.js';
import { getRedisClient } from '../config/redis.config.js';
import { saveMessageToDB } from '../services/database.service.js';
import { saveLead } from '../services/leads.service.js';
import { logError, logSuccess, logInfo, logConversation, logWarning } from '../services/logger.service.js';

export const chatWithAI = async (req, res) => {
  const { message, history, userId } = req.body;
  const userIdentifier = userId || 'postman-user-default';
  if (!message) {
    logWarning('Mensaje vacío recibido', 'chatWithAI');
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  // Usar userId del body o generar uno por defecto para Postman
  
  try {
      const redis = await getRedisClient();
      const fallasKey = `fallas:${userIdentifier}`;
      const fallasGuardadas = parseInt(await redis.get(fallasKey)) || 0;
    // 📝 Loguear conversación entrante
    logConversation(userIdentifier, 'user', message, 'ENTRADA');

    // 💾 Guardar mensaje del usuario
    await saveMessageToHistory(userIdentifier, 'user', message);
    // 💾 Guardar también en SQLite para la interfaz web
    console.log('[DEBUG] Guardando mensaje en SQLite:', {
      userIdentifier,
      role: 'user',
      message
    });
    saveMessageToDB(userIdentifier, 'user', message);

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
    
    let aiResponse;

    // 🤖 Generar respuesta
    logInfo(`Generando respuesta para ${userIdentifier}`, 'chatWithAI');
    try {
      aiResponse = await generateAIResponse({
          userMessage: message,
          conversationHistory,
          userId: userIdentifier,
        });
      await redis.del(fallasKey);
    } catch (error) {
      logError(error, 'generateAIResponse');
      await redis.set(fallasKey, fallasGuardadas + 1, 'EX', 60 * 60); // Incrementar fallas y expirar en 1 hora
      return res.status(500).json({
        reply: 'Ocurrió un error. Intenta nuevamente.',
        error: 'Error al generar respuesta de IA',
        details: error.message,
        userId: userIdentifier,
        shouldRetry: true,
      });
      if (aiResponse.fallas >= 2) {

        logWarning(`IA falló ${aiResponse.fallas} veces para ${userIdentifier}`, 'chatWithAI');


        const [
          redisName,
          redisEmail,
          redisAddress,
          redisPhone
        ] = await Promise.all([
          redis.get(`clientName:${userIdentifier}`),
          redis.get(`clientEmail:${userIdentifier}`),
          redis.get(`address:${userIdentifier}`),
          redis.get(`clientPhone:${userIdentifier}`)
        ]);

        const existingLead = await getLeadByUserId(userIdentifier);

        const leadData = {
          userId: userIdentifier,

          clientName: redisName || 'Sin nombre',
          clientPhone: redisPhone || '',
          clientEmail: redisEmail || '',
          serviceType: '',
          address: redisAddress || '',
          city: '',

          status: 'falla',
          conversation_mode: 'human',

          notes: (existingLead?.notes || '') + '\n⚠️ IA falló múltiples veces',

          preferredDate: '',
          preferredTime: '',

          eventId: null,
          calendarLink: null,
        };

        if (existingLead) {
          await updateLead(existingLead.id, leadData);
        } else {
          await saveLead(leadData);
        }

        return res.status(200).json({
          reply: 'Un asesor humano continuará contigo en breve.',
          userId: userIdentifier,
          forceHuman: true
        });
      }
    }
    
    // Extraer respuesta y datos de reservación si existen
    let response = aiResponse;
    let reservationResult = null;
    console.log('[DEBUG] Respuesta de IA:', aiResponse);
    if (
      typeof aiResponse === 'object' &&
      aiResponse.reservationRequest === true &&
      aiResponse.reservationData
    ) {
      logInfo('Solicitud de reservación detectada', 'chatWithAI');
      response = aiResponse.reply;

      // 📅 Procesar solicitud de reservación
      if (aiResponse.reservationData && aiResponse.reservationData.shouldReserve) {
        logInfo('Validando datos de reservación', 'chatWithAI');

        const notes = await generateNotesWithAI(conversationHistory);
        const existingReservations = await getUserReservations(userIdentifier);
        const enrichedData = {
          ...aiResponse.reservationData,
          notes: notes || '',
        };

        const validation = validateAndFormatReservationData(
          enrichedData,
          existingReservations
        );
        if (validation.valid) {
          // ✅ VALIDACIÓN PASÓ - Crear reservación
          logInfo('Datos validados, creando reservación', 'chatWithAI');
          reservationResult = await createReservation({
            userId: userIdentifier,
            ...validation.formatted,
          });

          if (reservationResult.success) {
            logSuccess(`Reservación creada para ${validation.formatted.clientName}`, 'chatWithAI');
            const redis = await getRedisClient();

            if (redis) {
              await redis.del(`reservationPhase:${userIdentifier}`);
              await redis.del(`pendingReservation:${userIdentifier}`);

              const sessionKey = `session:${userIdentifier}`;
              const sessionStr = await redis.get(sessionKey);

              if (sessionStr) {
                const session = JSON.parse(sessionStr);

                session.inReservationFlow = false;
                session.awaitingAppointmentConfirmation = false;
                session.pendingTechnicalVisitConfirmation = false;
                session.suggestedSlots = [];

                await redis.setEx(
                  sessionKey,
                  3600,
                  JSON.stringify(session)
                );
              }
            }
            try {
              saveLead({
                userId: userIdentifier,
                clientName: validation.formatted.clientName,
                clientPhone: validation.formatted.clientPhone,
                clientEmail: validation.formatted.clientEmail,
                serviceType: validation.formatted.serviceType,
                address: validation.formatted.address,
                city: validation.formatted.city,
                status: 'convertido',
                notes: validation.formatted.notes,
                preferredDate: validation.formatted.preferredDate,
                preferredTime: validation.formatted.preferredTime,
                eventId: reservationResult.eventId,
                calendarLink: reservationResult.eventLink,
              });
              logSuccess(`Lead guardado: ${validation.formatted.clientName}`, 'chatWithAI');
            } catch (leadError) {
              logError(leadError, 'saveLead');
            }

            // Solo aquí, tras éxito real, armar mensaje de confirmación
            response += `\n\n✅ *RESERVACIÓN CONFIRMADA*\n`;
            response += `📅 Fecha: ${new Date(reservationResult.reservation.dateTime).toLocaleDateString('es-MX')}\n`;
            response += `⏰ Hora: ${new Date(reservationResult.reservation.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
            response += `📍 Ubicación: ${reservationResult.reservation.address}\n`;
          } else {
            logError(new Error(reservationResult.error), 'createReservation');
            response += `\n\n❌ *No se pudo crear la reservación*\n`;
            response += `Error: ${reservationResult.error}`;
          }
        } else {
          // ❌ VALIDACIÓN FALLÓ
          logWarning(`Validación fallida: ${validation.error}`, 'chatWithAI');
          response = validation.error;

          // Si hay sugerencia de horario alternativo, mostrarlo de forma clara
          if (validation.suggestedDateTime) {
            const suggested = new Date(validation.suggestedDateTime);
            response += `\n\nTe propongo el siguiente horario disponible: `;
            response += `\n📅 Fecha: ${suggested.toLocaleDateString('es-MX')}`;
            response += `\n⏰ Hora: ${suggested.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
            response += `\n¿Te gustaría agendar para ese horario?`;
          }

          // Mostrar todos los datos faltantes correctamente
          if (Array.isArray(validation.missingData) && validation.missingData.length > 0) {
            response += `\n\nNecesito que me proporciones:\n`;
            validation.missingData.forEach((item, index) => {
              response += `${index + 1}. ${item}\n`;
            });
          }
        }
      } else if (aiResponse.reservationData && Array.isArray(aiResponse.reservationData.missingData) && aiResponse.reservationData.missingData.length > 0) {
        // Mostrar todos los datos faltantes correctamente
        response += `\n\n📋 Para completar tu reservación, necesito que me proporciones:\n`;
        aiResponse.reservationData.missingData.forEach((item, index) => {
          response += `${index + 1}. ${item}\n`;
        });
      }
    }

    // 💾 Guardar respuesta de la IA
    await saveMessageToHistory(userIdentifier, 'assistant', response);
    // 💾 Guardar también en SQLite para la interfaz web
    let responseToSave = response;
    if (typeof response === 'object' && response !== null && typeof response.reply === 'string') {
      responseToSave = response.reply;
    }
    console.log('[DEBUG] Guardando respuesta en SQLite:', {
      userIdentifier,
      role: 'assistant',
      response: responseToSave
    });
    saveMessageToDB(userIdentifier, 'assistant', responseToSave);

    // 📝 Loguear conversación saliente
    let responseForLog = response;
    if (typeof responseForLog !== 'string') {
      if (responseForLog && typeof responseForLog.reply === 'string') {
        responseForLog = responseForLog.reply;
      } else {
        responseForLog = String(responseForLog);
      }
    }
    logConversation(userIdentifier, 'assistant', responseForLog, 'SALIDA');

    // Evitar doble anidación de 'reply' en la respuesta JSON
    let replyToSend = response;
    if (typeof replyToSend === 'object' && replyToSend !== null && typeof replyToSend.reply === 'string') {
      replyToSend = replyToSend.reply;
    }
    res.json({
      reply: replyToSend,
      userId: userIdentifier,
      historySize: conversationHistory.length,
      reservation: reservationResult ? {
        success: reservationResult.success,
        eventId: reservationResult.eventId,
        eventLink: reservationResult.eventLink,
      } : null,
    });
  } catch (error) {
    // 🔴 MANEJO DE ERRORES CON LOGGING
    logError(error, 'chatWithAI');

    const userIdentifier = req.body.userId || 'postman-user-default';
    const errorMessage = `❌ Hubo un problema procesando tu mensaje: "${error.message}"\n\n¿Podrías repetir lo que dijiste? Eso nos ayudará a resolver el problema.`;

    try {
      // Guardar el intento fallido en el historial
      await saveMessageToHistory(userIdentifier, 'assistant', errorMessage);
      console.log('[DEBUG] Guardando error en SQLite:', {
        userIdentifier,
        role: 'assistant',
        errorMessage
      });
      // Evitar bucle infinito si el error es de parámetros insuficientes
      if (!errorMessage.includes('Too few parameter values were provided')) {
        saveMessageToDB(userIdentifier, 'assistant', errorMessage);
      } else {
        console.warn('[WARN] No se guarda en SQLite para evitar bucle de error:', errorMessage);
      }
    } catch (historyError) {
      logError(historyError, 'saveMessageToHistory');
    }

    res.status(500).json({
      reply: errorMessage,
      error: 'Error al procesar el mensaje',
      details: error.message,
      userId: userIdentifier,
      shouldRetry: true,
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
