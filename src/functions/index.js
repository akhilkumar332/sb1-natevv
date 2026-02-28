// src/functions/index.js
import dotenv from 'dotenv';
import 'dotenv/config';
import * as functions from 'firebase-functions/v1';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DEDUPE_WINDOW_MS = 30 * 1000;
const MAX_REDACTION_DEPTH = 5;
const recentLogFingerprints = new Map();

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /secret/i,
  /private.?key/i,
  /api.?key/i,
  /session/i,
  /email/i,
  /phone/i,
  /idtoken/i,
  /access.?token/i,
  /refresh.?token/i,
];

const shouldRedactKey = (key) => SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || '')));

const sanitizeForLog = (value, depth = 0, seen = new WeakSet()) => {
  if (depth > MAX_REDACTION_DEPTH) return '[TruncatedDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result = {};
    Object.entries(value).slice(0, 100).forEach(([key, nestedValue]) => {
      if (shouldRedactKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeForLog(nestedValue, depth + 1, seen);
      }
    });
    if (Object.keys(value).length > 100) {
      result.__truncatedKeys = Object.keys(value).length - 100;
    }
    return result;
  }
  return String(value);
};

const serializeError = (error) => {
  if (!error) return null;
  const errObj = error instanceof Error ? error : new Error(String(error));
  const stack = typeof errObj.stack === 'string'
    ? errObj.stack.split('\n').slice(0, 10).join('\n')
    : undefined;
  const code = error && typeof error === 'object' && 'code' in error
    ? error.code
    : undefined;
  return sanitizeForLog({
    name: errObj.name,
    message: errObj.message,
    code,
    stack,
  });
};

const buildFingerprint = ({ event, level, error, meta }) => {
  const payload = {
    event,
    level,
    error: serializeError(error),
    meta: sanitizeForLog(meta),
  };
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
};

const shouldEmitLog = (fingerprint, dedupe) => {
  if (!dedupe) return true;
  const now = Date.now();
  const previous = recentLogFingerprints.get(fingerprint);
  if (previous && now - previous < LOG_DEDUPE_WINDOW_MS) {
    return false;
  }
  recentLogFingerprints.set(fingerprint, now);

  // Trim stale entries so map does not grow forever.
  if (recentLogFingerprints.size > 1000) {
    for (const [key, ts] of recentLogFingerprints.entries()) {
      if (now - ts > LOG_DEDUPE_WINDOW_MS * 2) {
        recentLogFingerprints.delete(key);
      }
    }
  }
  return true;
};

const logEvent = ({ level = 'info', event, error, meta, dedupe = true }) => {
  try {
    const fingerprint = buildFingerprint({ event, level, error, meta });
    if (!shouldEmitLog(fingerprint, dedupe)) return;
    const payload = {
      ts: new Date().toISOString(),
      level,
      event,
      fingerprint,
      meta: sanitizeForLog(meta),
      error: serializeError(error),
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch (logError) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'logger.failure',
      error: serializeError(logError),
    }));
  }
};

const resolveServiceAccountPath = () => {
  const envPath = process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    return resolve(envPath);
  }

  const defaultPath = resolve(__dirname, '../../secrets/firebase-admin-sdk.json');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
};

const loadServiceAccount = () => {
  const filePath = resolveServiceAccountPath();
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.private_key) {
      data.private_key = String(data.private_key).replace(/\\n/g, '\n');
    }
    return data;
  } catch (error) {
    logEvent({
      level: 'warn',
      event: 'firebase.service_account.load_failed',
      error,
      meta: { filePath },
    });
    return null;
  }
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  const rawPrivateKey = process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ? rawPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
    : undefined;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;

  const envServiceAccount = projectId && privateKey && clientEmail
    ? { projectId, privateKey, clientEmail }
    : null;

  try {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (envServiceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(envServiceAccount)
      });
    } else {
      admin.initializeApp();
    }
  } catch (error) {
    logEvent({
      level: 'warn',
      event: 'firebase.admin.init_fallback',
      error,
    });
    admin.initializeApp();
  }
}

// Initialize Express app
const app = express();

// Middleware
const allowedOrigins = (() => {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '';
  const envOrigins = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
  ];
  const combined = envOrigins.length > 0 ? envOrigins : defaults;
  return new Set(combined);
})();

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow non-browser or same-origin requests
  return allowedOrigins.has(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logEvent({
    level: 'info',
    event: 'http.request',
    dedupe: false,
    meta: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });
  next();
});

// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeFlow API',
      version: '1.0.0',
      description: 'API documentation for the LifeFlow blood donation application',
    },
    servers: [
      {
        url: `http://localhost:5001`,
        description: 'Local Development Server',
      },
      {
        url: 'https://bloodhubindia.netlify.app',
        description: 'Production Server',
      },
    ],
  },
  apis: ['./src/functions/index.js'], // Path to your API routes
};

// Routes

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Check API health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 message:
 *                   type: string
 */
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'API is running'
  });
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idToken:
 *                   type: string
 *       400:
 *         description: Invalid credentials
 */
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userCredential = await admin.auth().getUserByEmail(email);
    // Here you would typically validate the password with a custom auth method.
    // For simplicity, we are assuming the user exists and the password is correct.
    
    // Generate custom token (or handle your login logic)
    const idToken = await admin.auth().createCustomToken(userCredential.uid);
    
    res.status(200).json({ idToken });
  } catch (error) {
    logEvent({
      level: 'error',
      event: 'auth.login.failed',
      error,
      meta: {
        path: req.path,
        method: req.method,
        email: typeof email === 'string' ? email : null,
      },
    });
    res.status(400).json({ message: 'Invalid credentials' });
  }
});

/**
 * @swagger
 * /api/v1/donors:
 *   post:
 *     summary: Get a list of donors
 *     tags: [Donors]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bloodType:
 *                 type: string
 *                 description: Filter by blood type
 *     responses:
 *       200:
 *         description: List of donors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   bloodType:
 *                     type: string
 */
const listDonorsHandler = async (req, res) => {
  try {
    const bloodType = req.method === 'GET'
      ? null
      : (typeof req.body?.bloodType === 'string' ? req.body.bloodType.trim() : null);
    const usersRef = admin.firestore().collection('users').where('role', '==', 'donor');
    let snapshot;
    try {
      snapshot = bloodType
        ? await usersRef.where('bloodType', '==', bloodType).limit(200).get()
        : await usersRef.limit(200).get();
    } catch (error) {
      if (bloodType) {
        logEvent({
          level: 'warn',
          event: 'donors.list.filtered_query_failed_fallback',
          error,
          meta: {
            bloodType,
            path: req.path,
            method: req.method,
          },
        });
        snapshot = await usersRef.limit(200).get();
      } else {
        throw error;
      }
    }
    let donors = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((donor) => donor.status !== 'deleted' && donor.onboardingCompleted !== false)
      .map((donor) => ({
        uid: donor.uid || donor.id,
        bhId: donor.bhId || null,
        displayName: donor.displayName || donor.name || null,
        bloodType: donor.bloodType || null,
        gender: donor.gender || null,
        city: donor.city || null,
        state: donor.state || null,
        address: donor.address || null,
        latitude: typeof donor.latitude === 'number' ? donor.latitude : null,
        longitude: typeof donor.longitude === 'number' ? donor.longitude : null,
        isAvailable: donor.isAvailable !== false,
        availableUntil: donor.availableUntil?.toDate
          ? donor.availableUntil.toDate().toISOString()
          : donor.availableUntil || null,
        lastDonation: donor.lastDonation?.toDate
          ? donor.lastDonation.toDate().toISOString()
          : donor.lastDonation || null,
        donationTypes: Array.isArray(donor.donationTypes)
          ? donor.donationTypes
          : donor.donationType
            ? [donor.donationType]
            : ['whole'],
      }));

    if (bloodType) {
      donors = donors.filter((donor) => donor.bloodType === bloodType);
    }

    res.status(200).json(donors);
  } catch (error) {
    logEvent({
      level: 'error',
      event: 'donors.list.failed',
      error,
      meta: {
        path: req.path,
        method: req.method,
        bloodType: typeof req.body?.bloodType === 'string' ? req.body.bloodType : null,
      },
    });
    res.status(500).json({
      message: 'Failed to fetch donors',
      details: process.env.NODE_ENV === 'production' ? undefined : String(error?.message || error),
    });
  }
};

app.get('/api/v1/donors', listDonorsHandler);
app.post('/api/v1/donors', listDonorsHandler);
app.get('/v1/donors', listDonorsHandler);

/**
 * @swagger
 * /api/v1/blood-requests:
 *   post:
 *     summary: Create a new blood request
 *     tags: [Blood Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bloodType
 *               - quantity
 *             properties:
 *               bloodType:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Blood request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 */
app.post('/api/v1/blood-requests', async (req, res) => {
  const { bloodType, quantity } = req.body;

  if (!bloodType || !quantity) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  // Here you would typically save the blood request to your database
  res.status(201).json({ message: 'Blood request created successfully' });
});

// Swagger setup
const specs = swaggerJsdoc(swaggerOptions);
app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ========================================================================
// Scheduled Jobs: Inventory Expiry + Alerts
// ========================================================================

const calculateInventoryStatus = (units, lowLevel = 10, criticalLevel = 5) => {
  if (units <= 0) return 'critical';
  if (units <= criticalLevel) return 'critical';
  if (units <= lowLevel) return 'low';
  if (units > lowLevel * 3) return 'surplus';
  return 'adequate';
};

export const inventoryExpiryJob = functions.pubsub
  .schedule('every day 02:30')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const alertDays = [7, 3, 1];

    const inventorySnapshot = await db.collection('bloodInventory').get();
    const bulkWriter = db.bulkWriter();

    for (const docSnap of inventorySnapshot.docs) {
      const data = docSnap.data();
      const batches = Array.isArray(data.batches) ? data.batches : [];
      let expiredUnits = 0;
      let updated = false;

      const nowTimestamp = admin.firestore.Timestamp.now();
      const nextBatches = batches.map((batch) => {
        const expiryDate = batch.expiryDate?.toDate ? batch.expiryDate.toDate() : null;
        const status = batch.status || 'available';
        if (expiryDate && (status === 'available' || status === 'reserved') && expiryDate <= now) {
          expiredUnits += batch.units || 0;
          updated = true;
          return {
            ...batch,
            status: 'expired',
            updatedAt: nowTimestamp,
          };
        }
        return batch;
      });

      if (updated) {
        const currentUnits = data.units || 0;
        const nextUnits = Math.max(0, currentUnits - expiredUnits);
        const status = calculateInventoryStatus(nextUnits, data.lowLevel || 10, data.criticalLevel || 5);

        bulkWriter.update(docSnap.ref, {
          batches: nextBatches,
          units: nextUnits,
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (expiredUnits > 0) {
          bulkWriter.set(db.collection('inventoryTransactions').doc(), {
            hospitalId: data.hospitalId,
            inventoryId: docSnap.id,
            bloodType: data.bloodType || '',
            type: 'expire',
            deltaUnits: -expiredUnits,
            previousUnits: currentUnits,
            newUnits: nextUnits,
            reason: 'Scheduled expiry cleanup',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'system',
          });
        }
      }

      for (const batch of batches) {
        const expiryDate = batch.expiryDate?.toDate ? batch.expiryDate.toDate() : null;
        const status = batch.status || 'available';
        if (!expiryDate || !(status === 'available' || status === 'reserved')) continue;
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        for (const threshold of alertDays) {
          if (daysLeft > threshold || daysLeft < 0) continue;
          const alertId = `${docSnap.id}_${batch.batchId}_${threshold}`;
          const alertRef = db.collection('inventoryAlerts').doc(alertId);
          const existing = await alertRef.get();
          if (existing.exists && existing.data()?.status !== 'open') continue;
          bulkWriter.set(alertRef, {
            hospitalId: data.hospitalId,
            inventoryId: docSnap.id,
            bloodType: data.bloodType || '',
            batchId: batch.batchId,
            alertType: 'expiry',
            daysToExpiry: daysLeft,
            status: 'open',
            message: `Batch expires in ${daysLeft} days`,
            createdAt: existing.exists ? existing.data()?.createdAt : admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }

    await bulkWriter.close();

    // Release reservations for expired/cancelled requests
    const reservationsSnapshot = await db.collection('inventoryReservations').where('status', '==', 'active').get();
    for (const reservationDoc of reservationsSnapshot.docs) {
      const reservation = reservationDoc.data();
      if (!reservation?.requestId) continue;
      const requestSnap = await db.collection('bloodRequests').doc(reservation.requestId).get();
      const requestStatus = requestSnap.exists ? requestSnap.data()?.status : 'expired';
      if (!['expired', 'cancelled'].includes(requestStatus)) continue;

      const inventoryRef = db.collection('bloodInventory').doc(reservation.inventoryId);
      const inventorySnap = await inventoryRef.get();
      if (!inventorySnap.exists) continue;
      const inventoryData = inventorySnap.data();
      const batches = Array.isArray(inventoryData?.batches) ? inventoryData.batches : [];
      const nowTimestamp = admin.firestore.Timestamp.now();
      const nextBatches = batches.map((batch) => {
        if (!reservation.reservedBatchIds?.includes(batch.batchId)) return batch;
        return {
          ...batch,
          status: 'available',
          reservationId: '',
          reservedForRequestId: '',
          reservedByUid: '',
          updatedAt: nowTimestamp,
        };
      });

      await inventoryRef.update({
        batches: nextBatches,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await reservationDoc.ref.update({
        status: requestStatus === 'expired' ? 'expired' : 'released',
        requestStatus,
        releasedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });

export const donorRequestExpiryJob = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const batchSize = 500;
    let expiredCount = 0;
    let lastDoc = null;

    while (true) {
      let query = db
        .collection('donorRequests')
        .where('status', '==', 'accepted')
        .where('connectionExpiresAt', '<=', now)
        .orderBy('connectionExpiresAt')
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      const bulkWriter = db.bulkWriter();
      snapshot.docs.forEach((docSnap) => {
        bulkWriter.update(docSnap.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await bulkWriter.close();

      expiredCount += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    logEvent({
      level: 'info',
      event: 'jobs.donor_request_expiry.completed',
      dedupe: false,
      meta: { expiredCount },
    });
    return null;
  });

// 404 handling
app.use((req, res) => {
  logEvent({
    level: 'warn',
    event: 'http.404',
    dedupe: false,
    meta: {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    },
  });
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/donors',
      '/api/v1/blood-requests'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logEvent({
    level: 'error',
    event: 'http.unhandled_error',
    error: err,
    meta: {
      path: req.originalUrl || req.path,
      method: req.method,
      ip: req.ip,
      body: req.body,
      query: req.query,
    },
  });
  res.status(500).json({
    error : 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Only run standalone server if not in Firebase Cloud Functions environment
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    logEvent({
      level: 'info',
      event: 'server.started',
      dedupe: false,
      meta: {
        port: PORT,
        swaggerUrl: `http://localhost:${PORT}/v1/api-docs`,
      },
    });
  });
}

// Keep the Firebase Cloud Function export
export const api = functions.https.onRequest((req, res) => {
  if (!req.path) {
    req.url = `/${req.url}`; // prepend '/' to keep query params if any
  }
  return app(req, res);
});
