import { Router } from 'express';
import { getRecentLogs, getLogFiles, readLogFile, cleanOldLogs } from '../services/logger.service.js';

const router = Router();

/**
 * GET /logs/recent
 * Obtiene los últimos 50 logs
 */
router.get('/recent', (req, res) => {
  try {
    const lines = req.query.lines ? parseInt(req.query.lines) : 50;
    const logs = getRecentLogs(lines);

    res.json({
      total: logs.length,
      logs,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo logs recientes',
      details: error.message,
    });
  }
});

/**
 * GET /logs/files
 * Obtiene lista de archivos de log disponibles
 */
router.get('/files', (req, res) => {
  try {
    const files = getLogFiles();

    res.json({
      total: files.length,
      files,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error listando archivos de log',
      details: error.message,
    });
  }
});

/**
 * GET /logs/:fileName
 * Obtiene contenido de un archivo de log específico
 */
router.get('/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;

    // Validar que el nombre sea seguro (solo fechas en formato YYYY-MM-DD.log)
    if (!/^\d{4}-\d{2}-\d{2}\.log$/.test(fileName)) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const content = readLogFile(fileName);

    if (!content) {
      return res.status(404).json({ error: 'Archivo de log no encontrado' });
    }

    res.json({
      fileName,
      content,
      lines: content.split('\n').filter(line => line.trim()).length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error leyendo archivo de log',
      details: error.message,
    });
  }
});

/**
 * POST /logs/cleanup
 * Limpia logs antiguos
 */
router.post('/cleanup', (req, res) => {
  try {
    const daysToKeep = req.body.daysToKeep || 7;

    cleanOldLogs(daysToKeep);

    res.json({
      message: `Logs anteriores a ${daysToKeep} días eliminados`,
      daysToKeep,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error limpiando logs',
      details: error.message,
    });
  }
});

export default router;
