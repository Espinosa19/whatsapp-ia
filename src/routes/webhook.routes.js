import { Router } from 'express';
import {
  verifyWebhook,
  receiveMessage
} from '../controllers/webhook.controller.js';

const router = Router();

// ✅ Verificación oficial de WhatsApp
router.get('/', verifyWebhook);

// ✅ Mensajes entrantes de WhatsApp
router.post('/', receiveMessage);

export default router;
