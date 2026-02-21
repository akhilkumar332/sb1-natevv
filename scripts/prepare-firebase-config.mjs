import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const envFiles = ['.env.local', '.env'];
envFiles.forEach((envFile) => {
  const envPath = path.resolve(rootDir, envFile);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
});

export const writeFirebaseConfig = async () => {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || '',
  };

  const content = `self.firebaseConfig = ${JSON.stringify(config, null, 2)};\n`;
  const targetPath = path.resolve(__dirname, '../public/firebase-config.js');
  await writeFile(targetPath, content, 'utf8');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFirebaseConfig().catch((error) => {
    console.error('Failed to write firebase-config.js:', error);
    process.exit(1);
  });
}
