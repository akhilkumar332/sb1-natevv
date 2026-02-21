import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serviceAccountPath = path.resolve(rootDir, 'secrets', 'serviceAccount.json');

const getArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const token = getArg('token');
const userId = getArg('userId');
const userRole = getArg('userRole') || 'donor';
const type = getArg('type') || 'general';
const title = getArg('title') || 'Test';
const body = getArg('body') || 'Test data message';
const route = getArg('route') || '/donor/dashboard?panel=notifications';
const dataOnly = getArg('dataOnly') === '1';

if (!token || !userId) {
  console.error(
    'Usage: node scripts/send-fcm-data.mjs --token=FCM_TOKEN --userId=USER_ID [--userRole=donor] [--type=general] [--title=Test] [--body="..."] [--route=/donor/dashboard?panel=notifications] [--dataOnly=1]'
  );
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Missing service account file at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

try {
  const message = {
    token,
    data: {
      userId,
      userRole,
      type,
      title,
      body,
      route,
    },
  };

  if (!dataOnly) {
    message.notification = { title, body };
    message.webpush = {
      fcmOptions: { link: route },
    };
  }

  const response = await admin.messaging().send(message);
  console.log('Sent:', response);
} catch (error) {
  console.error('Failed to send:', error);
  process.exit(1);
}
