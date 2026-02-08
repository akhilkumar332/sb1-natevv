// src/functions/index.js
import dotenv from 'dotenv';
import 'dotenv/config';
import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

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
    console.warn('Failed to load service account file:', error);
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
    console.warn('Firebase Admin init failed, falling back to default credentials:', error);
    admin.initializeApp();
  }
}

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
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
    console.error('Login error:', error);
    res.status(400).json({ message: 'Invalid credentials' });
  }
});

/**
 * @swagger
 * /api/v1/donors:
 *   get:
 *     summary: Get a list of donors
 *     tags: [Donors]
 *     parameters:
 *       - in: query
 *         name: bloodType
 *         schema:
 *           type: string
 *         description: Filter by blood type
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
    const { bloodType } = req.query || {};
    const usersRef = admin.firestore().collection('users').where('role', '==', 'donor');
    let snapshot;
    try {
      snapshot = bloodType
        ? await usersRef.where('bloodType', '==', bloodType).limit(200).get()
        : await usersRef.limit(200).get();
    } catch (error) {
      if (bloodType) {
        console.warn('Blood type filtered query failed, falling back to unfiltered query:', error);
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
    console.error('Failed to fetch donors:', error);
    res.status(500).json({
      message: 'Failed to fetch donors',
      details: process.env.NODE_ENV === 'production' ? undefined : String(error?.message || error),
    });
  }
};

app.get('/api/v1/donors', listDonorsHandler);
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

// 404 handling
app.use((req, res) => {
  console.log('404 Not Found:', req.originalUrl);
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
  console.error('Error occurred:', err);
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
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/v1/api-docs`);
  });
}

// Keep the Firebase Cloud Function export
export const api = functions.https.onRequest((req, res) => {
  if (!req.path) {
    req.url = `/${req.url}`; // prepend '/' to keep query params if any
  }
  return app(req, res);
});
