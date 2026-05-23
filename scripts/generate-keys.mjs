import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'development-private.pem');
const publicKeyPath = path.join(keysDir, 'development-public.pem');

// Asegurar que la carpeta keys exista
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
  console.log(`[Seguridad] Carpeta de llaves creada en: ${keysDir}`);
}

// Generar claves si no existen
if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
  console.log('[Seguridad] Generando llaves criptográficas RSA para desarrollo local y CI...');
  
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(publicKeyPath, publicKey);
    
    console.log('[Seguridad] ¡Llaves generadas con éxito!');
    console.log(`  -> Privada (firmado): ${privateKeyPath}`);
    console.log(`  -> Pública (verificación): ${publicKeyPath}`);
  } catch (error) {
    console.error('[Seguridad] Error al generar las llaves:', error);
    process.exit(1);
  }
} else {
  console.log('[Seguridad] Las llaves de desarrollo ya existen. Omitiendo generación.');
}
