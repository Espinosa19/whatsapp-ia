import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let calendarInstance = null;

/**
 * Procesa y valida la clave privada
 * Maneja múltiples formatos de entrada
 */
function processPrivateKey(keyString) {
  if (!keyString) {
    throw new Error('Clave privada no proporcionada');
  }

  let key = keyString.trim();
  
  console.log('🔑 Procesando clave privada...');
  console.log('   - Longitud original:', key.length);
  console.log('   - Primeros 50 caracteres:', key.substring(0, 50));
  
  // Si la clave está entre comillas, removerlas
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
    console.log('   ✅ Removidas comillas');
  }
  
  // Reemplazar diferentes formas de saltos de línea
  // Primero reemplazar \\n (literales) con \n (reales)
  key = key.replace(/\\n/g, '\n');
  console.log('   ✅ Procesados saltos de línea');
  
  // Validar que la clave tenga los headers y footers correctos
  if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
    throw new Error('Clave privada no válida: falta "BEGIN PRIVATE KEY" o "END PRIVATE KEY"');
  }
  
  console.log('   ✅ Validación de estructura: OK');
  return key;
}

/**
 * Inicializa el cliente de Google Calendar
 * Soporta autenticación mediante Service Account (recomendado para chatbots)
 */
export async function getGoogleCalendarInstance() {
  if (calendarInstance) {
    return calendarInstance;
  }

  try {
    // Opción 1: Usar Service Account (recomendado para aplicaciones de servidor)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      console.log('🔐 Inicializando Google Calendar con Service Account...');
      
      const privateKey = processPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
      
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      calendarInstance = google.calendar({
        version: 'v3',
        auth: auth,
      });

      console.log('✅ Google Calendar inicializado (Service Account)');
    }
    // Opción 2: Usar archivo de credenciales JSON
    else if (process.env.GOOGLE_CREDENTIALS_PATH) {
      console.log('🔐 Inicializando Google Calendar con archivo de credenciales...');
      const credentialsPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH);
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

      const privateKey = processPrivateKey(credentials.private_key);

      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      calendarInstance = google.calendar({
        version: 'v3',
        auth: auth,
      });

      console.log('✅ Google Calendar inicializado (archivo de credenciales)');
    } else {
      console.warn('⚠️ Google Calendar: No se encontraron credenciales. Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY o GOOGLE_CREDENTIALS_PATH');
      return null;
    }

    return calendarInstance;
  } catch (error) {
    console.error('❌ Error inicializando Google Calendar:', error);
    return null;
  }
}

/**
 * Obtiene el ID del calendario (por defecto 'primary' = calendario del usuario autenticado)
 */
export function getCalendarId() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  console.log('📅 Calendar ID siendo usado:', calendarId);
  return calendarId;
}

/**
 * Valida si las credenciales de Google Calendar están configuradas
 */
export function isGoogleCalendarConfigured() {
  return !!(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
    process.env.GOOGLE_CREDENTIALS_PATH
  );
}
