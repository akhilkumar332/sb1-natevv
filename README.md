# BloodHub India

<p align="center">
  <img src="public/favicon.svg" alt="BloodHub India logo" width="96" height="96" />
</p>

<p align="center">
  Multi-portal blood donation and blood request platform built with React, TypeScript, Firebase, and Vite.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-20232A?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/Firebase-Platform-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8" alt="PWA Enabled" />
</p>

<p align="center">
  <img src="public/screenshots/wide.png" alt="BloodHub India application preview" width="100%" />
</p>

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Default local endpoints:

- frontend: `http://localhost:5180`
- local API: `http://localhost:5001`

Recommended verification before pushing changes:

```bash
npm run lint
npm run test:run
npm run build
```

## Overview

BloodHub India is a full-stack web platform for coordinating blood donation workflows across multiple stakeholders:

- Donors discover drives, manage requests, and track readiness.
- NGOs run campaigns, volunteers, donor outreach, and partnerships.
- Blood banks manage inventory, appointments, donors, and request fulfillment.
- Admins operate the platform through monitoring, verification, analytics, CMS, notifications, and security tooling.

The project combines a public-facing website with authenticated role-based portals, operational dashboards, push notifications, offline mutation handling, and Firebase-backed data services.

## Core Capabilities

### Public Platform

- Landing pages, about, contact, donor discovery, blood request flow, and blog.
- CMS-driven pages and blog content.
- SEO artifact generation for sitemap and robots output.
- PWA-ready frontend with service worker support in production.

### Donor Portal

- Registration, login, onboarding, and account management.
- Donation readiness, request management, blood drives, journey tracking, and referrals.

### NGO Portal

- Campaign management, volunteer operations, partnerships, donor management, analytics, referrals, and account controls.

### Blood Bank Portal

- Inventory management, donor operations, appointments, requests, analytics, referrals, and account controls.

### Admin Operations

- User administration across donors, NGOs, blood banks, and admins.
- Verification workflow for organizational onboarding.
- Emergency requests, inventory alerts, campaigns, partnerships, appointments, and donations.
- Analytics and reporting.
- CMS administration for pages, blog, categories, menus, media, and settings.
- Notifications, audit/security tooling, error logs, NPS management, impersonation audit, and offline sync health.

## Product Areas

| Area | Scope |
| --- | --- |
| Public Web | Home, about, contact, blog, donor discovery, blood requests |
| Role Portals | Donor, NGO, blood bank, admin |
| Data Platform | Firebase Auth, Firestore, Storage, Admin SDK |
| Operations | Verification, emergency workflows, inventory alerts, analytics |
| Content | CMS pages, CMS blog, navigation menus, media, settings |
| Reliability | Offline queueing, sync health, PWA, error logging, diagnostics |
| Messaging | Push notifications and FCM bridge tooling |

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- i18next
- Lucide React
- Leaflet

### Backend and Platform

- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Admin SDK
- Firebase Functions compatible server entrypoints
- Express

### Quality and Tooling

- ESLint
- Vitest
- Playwright
- Vite PWA plugin

## Architecture Summary

```text
Public Web + Role-Based Portals
        |
        v
React + Vite + TypeScript frontend
        |
        +--> Firebase Auth
        +--> Cloud Firestore
        +--> Firebase Storage
        +--> Notification / FCM bridge
        +--> Admin analytics and operational services
        |
        v
Offline outbox + sync health + diagnostics
```

## Repository Structure

```text
.
├── public/               Static assets, icons, screenshots, generated SEO files
├── scripts/              Build, migration, inventory, notification, and maintenance scripts
├── src/
│   ├── components/       Shared and role-specific UI components
│   ├── config/           Frontend configuration modules
│   ├── constants/        Route, query, theme, firestore, and feature constants
│   ├── hooks/            Shared and admin query hooks
│   ├── pages/            Public pages and portal/dashboard screens
│   ├── services/         Firestore, analytics, auth, notifications, and admin services
│   ├── utils/            Shared utilities and operational helpers
│   ├── generated/        Generated inventory and build-time artifacts
│   └── functions/        Server entrypoint code
├── firestore.rules       Firestore security rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
└── vite.config.ts
```

## Key Operational Features

- Offline mutation outbox with health telemetry and dead-letter visibility.
- Admin offline sync health dashboard for queue and incident monitoring.
- Generated offline write inventory for capability auditing.
- Runtime diagnostics and memory monitoring surfaces.
- Error capture pipeline for handled frontend failures.
- CMS governance surfaces for content operations.
- Query caching and admin data aggregation via TanStack Query.

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm
- Firebase project with Auth, Firestore, and Storage enabled

### Installation

```bash
npm install
cp .env.example .env
```

Update `.env` with your Firebase and local API configuration before running the app.

### Local Development

Start the frontend:

```bash
npm run dev
```

Start the local server entrypoint in a separate terminal if needed:

```bash
npm run dev:server
```

The frontend development server runs on `http://localhost:5180` and proxies API calls to the local server on `http://localhost:5001`.

### First-Time Setup Checklist

1. Create or select a Firebase project.
2. Enable Firebase Auth, Firestore, and Storage.
3. Populate client and server environment variables from `.env.example`.
4. Verify local API routing and Firebase credentials.
5. Run `npm run build` once to confirm generated artifacts and PWA build succeed.

## Environment Configuration

The project expects a combination of client-safe `VITE_` variables plus Firebase Functions runtime config and secrets.

### Client Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=
VITE_LOCAL_API_URL=
VITE_PROD_API_URL=
VITE_SENTRY_DSN=
VITE_GA_TRACKING_ID=
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_TRACKING=false
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

### Firebase Functions Runtime

Use `src/functions/.env` for non-sensitive runtime values and Firebase Secret Manager for sensitive values.

```env
FCM_BRIDGE_SIGNING_SECRET=
CONTACT_RATE_LIMIT_MAX_PER_MINUTE=5
FRONTEND_GATE_MAX_ATTEMPTS_PER_MINUTE=10
PORT=5001
```

Deployed Firebase Cloud Functions use the default Firebase service account. Do not set `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, or `FIREBASE_CLIENT_EMAIL` for the deployed runtime.

Use `.env.example` as the source of truth for required keys.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run dev:server` | Start the local Node server with nodemon |
| `npm run build` | Production-style app build plus generated artifacts |
| `npm run build:prod` | Explicit production build mode |
| `npm run preview` | Preview the built app locally |
| `npm run lint` | Run ESLint across the repository |
| `npm run test:run` | Run Vitest in CI mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run offline:inventory` | Regenerate offline write inventory |
| `npm run seo:generate` | Regenerate SEO artifacts |
| `npm run memory:baseline` | Capture memory baseline |
| `npm run memory:check` | Evaluate memory budgets |
| `npm run deploy` | Build and deploy Firebase resources |
| `npm run deploy:hosting` | Build and deploy hosting only |
| `npm run deploy:rules` | Deploy Firestore and Storage rules |
| `npm run deploy:indexes` | Deploy Firestore indexes |

## Build and Release Notes

The build pipeline performs more than a plain frontend bundle:

- regenerates the offline write inventory
- generates SEO artifacts
- creates the production bundle with legacy-browser support
- prepares the PWA service worker

Because of that, builds may update generated files in `public/` and `src/generated/`.

## Screenshots

### Wide Layout

![Wide application screenshot](public/screenshots/wide.png)

### Mobile Layout

![Mobile application screenshot](public/screenshots/mobile.png)

## Admin Surface Summary

The admin dashboard includes:

- Overview
- Users, donors, NGOs, and blood banks
- Verification queue
- Emergency requests
- Inventory alerts
- Campaigns
- Volunteers and partnerships
- Appointments and donations
- Analytics and reports
- NPS
- Audit and security
- Error logs
- Contact submissions
- Offline sync health
- CMS pages, blog, categories, menus, media, and settings
- Notifications
- Settings

## Security and Governance

- Firestore rules are maintained in [firestore.rules](firestore.rules).
- Firestore indexes are maintained in [firestore.indexes.json](firestore.indexes.json).
- Storage rules are maintained in [storage.rules](storage.rules).
- Error handling and audit flows are built into the admin and service layers.
- Sensitive server credentials must never be exposed through `VITE_` variables.

## Deployment

This repository is configured for Firebase deployment.

### Deployment Profile

| Layer | Current repo setup |
| --- | --- |
| Frontend build | Vite production build |
| Hosting target | Firebase-first deployment flow |
| Redirect support | `_redirects` copied into `dist/` |
| Serverless support | Firebase Hosting rewrites to Cloud Functions |
| Data platform | Firebase Auth, Firestore, Storage |
| Production API default | `https://api.bloodhubindia.com/api/v1` via Vite config fallback |

Typical deployment flow:

```bash
npm run build:prod
firebase deploy
```

For targeted releases:

```bash
npm run deploy:hosting
npm run deploy:rules
npm run deploy:indexes
```

### Operational Notes

- `npm run build` regenerates SEO artifacts and offline write inventory before bundling.
- PWA assets and service worker output are produced during the production build.
- Firebase rules and indexes are versioned in-repo and should be deployed with application changes that depend on them.

## Testing Strategy

- Unit and component tests with Vitest and Testing Library
- End-to-end coverage with Playwright
- Linting with ESLint
- Operational validation through generated inventories and monitoring dashboards

Recommended pre-merge checks:

```bash
npm run lint
npm run test:run
npm run build
```

## Known Repository Notes

- `docs/` is currently gitignored in this repository configuration.
- Build output may regenerate tracked sitemap and version artifacts in `public/`.
- The repository currently contains project automation workflows under `.github/workflows`.

## Roadmap Themes

- Stronger offline-first behavior across all mutation-heavy workflows
- Continued admin operations improvements
- CMS maturity and content governance
- Analytics depth and decision-support tooling
- Performance and memory optimization

## Contributing

Contribution guidance is available in [CONTRIBUTING.md](CONTRIBUTING.md).

Additional recommended governance files for a public distribution:

- `LICENSE`
- architecture decision records
- environment and secret management policy
- pull request and release templates
