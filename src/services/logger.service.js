import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

// Crear carpeta logs si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`📁 Carpeta de logs creada: ${logsDir}`);
}

/**
 * Obtiene la fecha formateada para los nombres de archivo
 */
function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.log`;
}

/**
 * Obtiene timestamp formateado
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Escribe en el archivo de log
 */
function writeToLog(logFileName, message) {
  try {
    const logPath = path.join(logsDir, logFileName);
    const timestamp = getTimestamp();
    const formattedMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logPath, formattedMessage, 'utf8');
  } catch (error) {
    console.error('❌ Error escribiendo en log:', error.message);
  }
}

/**
 * Log de errores
 */
export function logError(error, context = '') {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';

  const logEntry = `
❌ ERROR ${context ? `[${context}]` : ''}
Mensaje: ${errorMessage}
${stack ? `Stack: ${stack}` : ''}
---`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  // También mostrar en consola
  console.error(`❌ [${context}]`, errorMessage);
  if (stack) console.error(stack);
}

/**
 * Log de información
 */
export function logInfo(message, context = '') {
  const logEntry = `ℹ️ INFO ${context ? `[${context}]` : ''} ${message}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.log(`ℹ️ [${context}]`, message);
}

/**
 * Log de éxito
 */
export function logSuccess(message, context = '') {
  const logEntry = `✅ SUCCESS ${context ? `[${context}]` : ''} ${message}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.log(`✅ [${context}]`, message);
}

/**
 * Log de advertencia
 */
export function logWarning(message, context = '') {
  const logEntry = `⚠️ WARNING ${context ? `[${context}]` : ''} ${message}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.warn(`⚠️ [${context}]`, message);
}

/**
 * Log de solicitud HTTP
 */
export function logRequest(method, path, status, duration) {
  const logEntry = `📡 ${method} ${path} - Status: ${status} - ${duration}ms`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.log(`📡 ${method} ${path}`, `(${status}) ${duration}ms`);
}

/**
 * Log de conversación (chat)
 */
export function logConversation(userId, role, message, context = '') {
  const logEntry = `💬 CHAT [${context}] User: ${userId} | Role: ${role} | Msg: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());
}

/**
 * Log de reservación
 */
export function logReservation(userId, clientName, serviceType, status) {
  const logEntry = `📅 RESERVACIÓN [${status}] User: ${userId} | Cliente: ${clientName} | Servicio: ${serviceType}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.log(`📅 [RESERVACIÓN]`, `${clientName} - ${serviceType}`);
}

/**
 * Log de lead
 */
export function logLead(clientName, clientPhone, status) {
  const logEntry = `👥 LEAD [${status}] Cliente: ${clientName} | Teléfono: ${clientPhone}`;

  const logFileName = getLogFileName();
  writeToLog(logFileName, logEntry.trim());

  console.log(`👥 [LEAD]`, `${clientName} - ${status}`);
}

/**
 * Obtiene los últimos logs (para debugging)
 */
export function getRecentLogs(lines = 50) {
  try {
    const logFileName = getLogFileName();
    const logPath = path.join(logsDir, logFileName);

    if (!fs.existsSync(logPath)) {
      return [];
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const logLines = content.split('\n').filter(line => line.trim());

    return logLines.slice(-lines);
  } catch (error) {
    console.error('❌ Error leyendo logs:', error.message);
    return [];
  }
}

/**
 * Obtiene todos los archivos de log disponibles
 */
export function getLogFiles() {
  try {
    const files = fs.readdirSync(logsDir);
    return files
      .filter(file => file.endsWith('.log'))
      .sort()
      .reverse();
  } catch (error) {
    console.error('❌ Error listando archivos de log:', error.message);
    return [];
  }
}

/**
 * Lee un archivo de log específico
 */
export function readLogFile(fileName) {
  try {
    const logPath = path.join(logsDir, fileName);

    if (!fs.existsSync(logPath)) {
      return null;
    }

    return fs.readFileSync(logPath, 'utf8');
  } catch (error) {
    console.error('❌ Error leyendo archivo de log:', error.message);
    return null;
  }
}

/**
 * Limpia logs antiguos (más de N días)
 */
export function cleanOldLogs(daysToKeep = 7) {
  try {
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (!file.endsWith('.log')) return;

      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > daysToKeep * millisecondsPerDay) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Log antiguo eliminado: ${file}`);
      }
    });
  } catch (error) {
    console.error('❌ Error limpiando logs antiguos:', error.message);
  }
}

export default {
  logError,
  logInfo,
  logSuccess,
  logWarning,
  logRequest,
  logConversation,
  logReservation,
  logLead,
  getRecentLogs,
  getLogFiles,
  readLogFile,
  cleanOldLogs,
};
