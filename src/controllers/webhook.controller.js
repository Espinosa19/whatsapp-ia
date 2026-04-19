import axios from 'axios';
import { generateAIResponse } from '../services/ai.service.js';
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
    const aiReply = await generateAIResponse({
      userMessage: text,
      conversationHistory: formattedHistory,
    });

    // 💾 Guardar respuesta de la IA
    await saveMessageToHistory(from, 'assistant', aiReply);

    // 📤 Enviar respuesta a WhatsApp
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: aiReply },
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
