import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const serviceAccountPath = path.resolve(rootDir, 'secrets', 'firebase-admin-sdk.json');

const getArg = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
};

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

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizeToken = (value) => (typeof value === 'string' ? value.trim() : '');
const sanitizeSegment = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');

const hasToken = (details, token) => Object.values(details).some((detail) => normalizeToken(detail?.token) === token);

let lastDoc = null;
let totalUsers = 0;
let usersScannedWithLegacy = 0;
let usersWithWrites = 0;
let usersMigratedFromLegacy = 0;
let legacyTokenArrayEntriesFolded = 0;
let legacyDeviceMapEntriesFolded = 0;

console.log(`Starting migration. apply=${apply ? 'yes' : 'no'}, batch=${batchSize}`);

while (true) {
  let usersQuery = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
  if (lastDoc) {
    usersQuery = usersQuery.startAfter(lastDoc);
  }

  const snapshot = await usersQuery.get();
  if (snapshot.empty) break;

  const batch = db.batch();
  let batchWrites = 0;

  for (const docSnap of snapshot.docs) {
    totalUsers += 1;

    const data = docSnap.data() || {};
    const legacyArray = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
    const legacyMap = isRecord(data.fcmDeviceTokens) ? data.fcmDeviceTokens : {};
    const canonicalDetails = isRecord(data.fcmDeviceDetails) ? data.fcmDeviceDetails : {};
    const hasLegacyFields = Array.isArray(data.fcmTokens) || isRecord(data.fcmDeviceTokens);
    if (!hasLegacyFields) {
      continue;
    }
    usersScannedWithLegacy += 1;

    const nextDetails = { ...canonicalDetails };
    let detailsChanged = false;
    let foldedFromMap = 0;
    let foldedFromArray = 0;

    Object.entries(legacyMap).forEach(([deviceIdRaw, tokenRaw]) => {
      const deviceId = sanitizeSegment(deviceIdRaw);
      const token = normalizeToken(tokenRaw);
      if (!deviceId || !token) return;

      const existing = isRecord(nextDetails[deviceId]) ? { ...nextDetails[deviceId] } : {};
      const existingToken = normalizeToken(existing.token);
      if (existingToken) return;

      nextDetails[deviceId] = {
        ...existing,
        token,
        info: isRecord(existing.info) ? existing.info : {},
        updatedAt: existing.updatedAt || data.lastTokenUpdate || admin.firestore.FieldValue.serverTimestamp(),
      };
      detailsChanged = true;
      foldedFromMap += 1;
    });

    legacyArray.forEach((entry, index) => {
      const token = normalizeToken(entry);
      if (!token || hasToken(nextDetails, token)) {
        return;
      }
      let keyBase = `legacy_token_${index}`;
      let key = keyBase;
      let suffix = 1;
      while (nextDetails[key]) {
        key = `${keyBase}_${suffix}`;
        suffix += 1;
      }
      nextDetails[key] = {
        token,
        info: {},
        updatedAt: data.lastTokenUpdate || admin.firestore.FieldValue.serverTimestamp(),
      };
      detailsChanged = true;
      foldedFromArray += 1;
    });

    const updates = {};
    if (detailsChanged) {
      updates.fcmDeviceDetails = nextDetails;
      updates.lastTokenUpdate = admin.firestore.FieldValue.serverTimestamp();
      usersMigratedFromLegacy += 1;
      legacyTokenArrayEntriesFolded += foldedFromArray;
      legacyDeviceMapEntriesFolded += foldedFromMap;
    }
    if (Array.isArray(data.fcmTokens)) {
      updates.fcmTokens = admin.firestore.FieldValue.delete();
    }
    if (isRecord(data.fcmDeviceTokens)) {
      updates.fcmDeviceTokens = admin.firestore.FieldValue.delete();
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    usersWithWrites += 1;
    if (apply) {
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

console.log('Migration complete.');
console.log({
  apply,
  totalUsers,
  usersScannedWithLegacy,
  usersWithWrites,
  usersMigratedFromLegacy,
  legacyTokenArrayEntriesFolded,
  legacyDeviceMapEntriesFolded,
});
