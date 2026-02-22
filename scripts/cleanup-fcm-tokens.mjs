import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serviceAccountPath = path.resolve(rootDir, 'secrets', 'firebase-admin-sdk.json');

const getArg = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
};

const ttlDays = Number(getArg('ttlDays', '60')) || 60;
const apply = getArg('apply', '0') === '1';
const batchSize = Math.min(Number(getArg('batch', '250')) || 250, 500);

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

const db = admin.firestore();
const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

const asDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

let lastDoc = null;
let totalUsers = 0;
let touchedUsers = 0;
let removedTokensTotal = 0;
let removedDevicesTotal = 0;

console.log(`Starting cleanup. ttlDays=${ttlDays}, apply=${apply ? 'yes' : 'no'}, batch=${batchSize}`);

while (true) {
  let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  const snapshot = await query.get();
  if (snapshot.empty) break;

  const batch = db.batch();
  let batchWrites = 0;

  for (const docSnap of snapshot.docs) {
    totalUsers += 1;
    const data = docSnap.data() || {};
    const fcmTokens = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
    const fcmDeviceTokens = data.fcmDeviceTokens || {};
    const fcmDeviceDetails = data.fcmDeviceDetails || {};

    const deviceIds = Object.keys(fcmDeviceTokens);
    if (deviceIds.length === 0) {
      continue;
    }

    const tokensToKeep = new Set();
    const staleDeviceIds = [];

    for (const deviceId of deviceIds) {
      const token = fcmDeviceTokens?.[deviceId];
      if (!token) continue;
      const detail = fcmDeviceDetails?.[deviceId];
      const updatedAt = asDate(detail?.updatedAt);
      if (updatedAt && Date.now() - updatedAt.getTime() > ttlMs) {
        staleDeviceIds.push(deviceId);
        continue;
      }
      tokensToKeep.add(token);
    }

    const nextTokens = Array.from(tokensToKeep);
    const tokensToRemove = fcmTokens.filter((token) => !tokensToKeep.has(token));

    if (tokensToRemove.length === 0 && staleDeviceIds.length === 0) {
      continue;
    }

    touchedUsers += 1;
    removedTokensTotal += tokensToRemove.length;
    removedDevicesTotal += staleDeviceIds.length;

    if (apply) {
      const updates = {};
      if (nextTokens.length > 0) {
        updates.fcmTokens = nextTokens;
      } else if (fcmTokens.length > 0) {
        updates.fcmTokens = admin.firestore.FieldValue.delete();
      }
      for (const deviceId of staleDeviceIds) {
        updates[`fcmDeviceTokens.${deviceId}`] = admin.firestore.FieldValue.delete();
        updates[`fcmDeviceDetails.${deviceId}`] = admin.firestore.FieldValue.delete();
      }
      updates.lastTokenUpdate = admin.firestore.FieldValue.serverTimestamp();
      batch.update(docSnap.ref, updates);
      batchWrites += 1;
    }
  }

  if (apply && batchWrites > 0) {
    await batch.commit();
  }

  lastDoc = snapshot.docs[snapshot.docs.length - 1];
  console.log(`Processed ${totalUsers} users...`);
}

console.log('Done.');
console.log({
  totalUsers,
  touchedUsers,
  removedTokensTotal,
  removedDevicesTotal,
  apply,
});
