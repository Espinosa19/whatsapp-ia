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
  // Tabla de mensajes
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de estadísticas
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      message_count INTEGER DEFAULT 0,
      last_message DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Tablas SQLite inicializadas');
}

export default getDatabase;
