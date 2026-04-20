#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔍 DIAGNÓSTICO DE CREDENCIALES DE GOOGLE CALENDAR\n');

// Verificar Opción 1: Variables de entorno
if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  console.log('✅ Opción 1 DETECTADA: Usando variables de entorno');
  console.log('   Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  
  const key = process.env.GOOGLE_PRIVATE_KEY;
  console.log('\n🔑 Verificando clave privada:');
  console.log('   - Longitud:', key.length, 'caracteres');
  console.log('   - Empieza con:', key.substring(0, 30));
  console.log('   - Termina con:', key.substring(key.length - 30));
  
  // Verificar formato
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }
  cleanKey = cleanKey.replace(/\\n/g, '\n');
  
  const hasBegin = cleanKey.includes('BEGIN PRIVATE KEY');
  const hasEnd = cleanKey.includes('END PRIVATE KEY');
  
  console.log('\n📋 Validación de estructura:');
  console.log('   - Tiene "BEGIN PRIVATE KEY":', hasBegin ? '✅' : '❌');
  console.log('   - Tiene "END PRIVATE KEY":', hasEnd ? '✅' : '❌');
  
  if (hasBegin && hasEnd) {
    console.log('\n✅ ¡Clave privada parece estar bien formateada!');
  } else {
    console.log('\n❌ ERROR: La clave privada no tiene el formato correcto');
    console.log('   Asegúrate de que tiene:');
    console.log('   - -----BEGIN PRIVATE KEY-----');
    console.log('   - -----END PRIVATE KEY-----');
  }
} 
// Verificar Opción 2: Archivo JSON
else if (process.env.GOOGLE_CREDENTIALS_PATH) {
  console.log('✅ Opción 2 DETECTADA: Usando archivo de credenciales');
  console.log('   Ruta:', process.env.GOOGLE_CREDENTIALS_PATH);
  
  try {
    const fs = await import('fs');
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH.startsWith('/') 
      ? process.env.GOOGLE_CREDENTIALS_PATH 
      : new URL(`file://${process.cwd()}/${process.env.GOOGLE_CREDENTIALS_PATH}`).pathname;
    
    if (fs.existsSync(credentialsPath)) {
      console.log('   ✅ Archivo encontrado');
      
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      console.log('   - Email:', credentials.client_email);
      console.log('   - Tipo:', credentials.type);
      
      if (credentials.private_key) {
        console.log('   ✅ Clave privada presente');
        const key = credentials.private_key;
        console.log('   - Longitud:', key.length);
        console.log('   - Empieza con:', key.substring(0, 30));
      } else {
        console.log('   ❌ ERROR: No hay clave privada en el archivo');
      }
    } else {
      console.log('   ❌ ERROR: Archivo no encontrado en', credentialsPath);
    }
  } catch (error) {
    console.log('   ❌ ERROR al leer archivo:', error.message);
  }
}
else {
  console.log('❌ ERROR: No se detectó ninguna configuración de Google Calendar');
  console.log('\nDebes configurar UNA de estas opciones en tu archivo .env:\n');
  console.log('OPCIÓN 1 - Variables de entorno:');
  console.log('  GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com');
  console.log('  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
  console.log('  GOOGLE_CALENDAR_ID=primary');
  console.log('  TIMEZONE=America/Mexico_City\n');
  console.log('OPCIÓN 2 - Archivo de credenciales (RECOMENDADO):');
  console.log('  GOOGLE_CREDENTIALS_PATH=./credentials.json');
  console.log('  GOOGLE_CALENDAR_ID=primary');
  console.log('  TIMEZONE=America/Mexico_City');
}

console.log('\n' + '='.repeat(60) + '\n');
