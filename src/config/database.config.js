import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'whatsapp-bot.db');

let db = null;

export function getDatabase() {
  if (!db) {
    try {
      // Crear carpeta data si no existe
      if (!existsSync(dataDir)) {
        console.log(`📁 Creando carpeta: ${dataDir}`);
        mkdirSync(dataDir, { recursive: true });
      }
      
      console.log(`🗄️  Abriendo BD en: ${dbPath}`);
      db = new Database(dbPath, { verbose: null });
      
      // Configurar WAL mode
      db.pragma('journal_mode = WAL');
      
      initializeTables();
      console.log(`✅ Base de datos conectada correctamente`);
    } catch (error) {
      console.error('❌ Error conectando BD:', error.message);
      console.error('   Ruta:', dbPath);
      console.error('   Error completo:', error);
      throw error;
    }
  }
  return db;
}
function initializeTables() {
  // 📩 Tabla de mensajes
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 📊 Tabla de estadísticas
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      message_count INTEGER DEFAULT 0,
      last_message DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 🔥 TABLA LEADS (PRIMERO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      client_email TEXT,
      service_type TEXT,
      address TEXT,
      city TEXT,
      status TEXT DEFAULT 'nuevo',
      notes TEXT,
      preferred_date TEXT,
      preferred_time TEXT,
      event_id TEXT,
      calendar_link TEXT,
      conversation_mode TEXT DEFAULT 'bot',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, client_phone)
    )
  `);

  // 🔍 DESPUÉS validar columnas
  const columns = db.prepare(`PRAGMA table_info(leads)`).all();

  const hasConversationMode = columns.some(col => col.name === 'conversation_mode');

  if (!hasConversationMode) {
    console.log('➕ Agregando columna conversation_mode...');

    db.exec(`
      ALTER TABLE leads 
      ADD COLUMN conversation_mode TEXT DEFAULT 'bot'
    `);
  }

  console.log('✅ Tablas SQLite inicializadas');
}
export default getDatabase;
