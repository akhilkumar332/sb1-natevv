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
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL
  })
});

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
app.get('/api/v1/donors', async (req, res) => {
  // Simulated donor data
  const donors = [
    { id: '1', name: 'John Doe', bloodType: 'A+' },
    { id: '2', name: 'Jane Smith', bloodType: 'O-' },
  ];
  
  res.status(200).json(donors);
});

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