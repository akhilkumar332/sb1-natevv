# BloodHub India

<p align="center">
  <img src="public/favicon.svg" alt="BloodHub India logo" width="96" height="96" />
</p>

<p align="center">
  Multi-portal blood donation platform built with React, TypeScript, Firebase, Vite, Tailwind CSS, and PWA tooling.
</p>

## Overview

BloodHub India combines a public website with authenticated role-based portals for:

- donors
- NGOs
- blood banks
- admins and superadmins

The app is Firebase-first:

- Firebase Hosting serves the frontend
- Firebase Cloud Functions under `src/functions/` serve backend endpoints
- Firestore is the primary datastore
- Firebase Auth and Storage are core platform dependencies

The project also includes:

- CMS-managed pages and blog content
- admin analytics and operational dashboards
- offline mutation queueing and offline sync health
- WebAuthn and impersonation flows
- service worker / PWA support
- SEO asset generation into `public/`

## Current Runtime Model

Production routing is configured in [firebase.json](./firebase.json):

- frontend assets are served from `dist/`
- `/api/**` is rewritten to the `api` Firebase Function
- `/functions/**` paths are rewritten to named Firebase Functions

The active server/backend surface is:

- [src/functions/index.js](./src/functions/index.js)
- [src/functions/http-handlers/](./src/functions/http-handlers)

The frontend uses centralized backend constants in:

- [src/constants/backend.ts](./src/constants/backend.ts)

## Main Product Areas

- Public web: home, about, contact, donor discovery, blood request flow, CMS pages, blog
- Donor portal: auth, onboarding, readiness, drives, referrals, account, journey
- NGO portal: campaigns, volunteers, partnerships, analytics, referrals
- Blood bank portal: inventory, appointments, requests, donors, analytics
- Admin portal: verification, users, emergency workflows, inventory alerts, analytics, CMS, notifications, error logs, offline sync health, impersonation audit

## Tech Stack

Frontend:

- React 18
- TypeScript
- Vite 5
- Tailwind CSS
- TanStack Query
- React Router
- i18next
- Leaflet

Platform and backend:

- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Hosting
- Firebase Cloud Functions
- Firebase Admin SDK
- Express

Tooling:

- ESLint
- Vitest
- Playwright
- Vite PWA plugin

## Repository Layout

```text
.
├── public/                 Static assets and generated SEO/runtime files
├── scripts/                Build, SEO, inventory, migration, and ops scripts
├── src/
│   ├── components/         Shared, admin, CMS, analytics, and mobile UI
│   ├── constants/          Route, backend, Firestore, offline, and theme constants
│   ├── contexts/           Auth, query, theme, network status providers
│   ├── functions/          Firebase Functions runtime and local server support
│   ├── hooks/              Feature, admin, auth, and data hooks
│   ├── pages/              Public pages and portal/dashboard screens
│   ├── services/           Firestore, auth, CMS, analytics, notifications, admin services
│   ├── test/               Shared test setup and helpers
│   ├── types/              Shared type definitions
│   └── utils/              Shared utility and operational helpers
├── docs/                   Project plans, implementation notes, audits
├── workflow/               Contributor workflow and source-of-truth docs
├── firebase.json           Hosting, functions, rules, indexes, emulator config
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── vite.config.ts
```

## Local Development

### Prerequisites

- Node.js 20+ for the frontend/tooling
- npm
- a Firebase project for local integration/emulator work

Functions runtime is configured for Node 22 in [src/functions/package.json](./src/functions/package.json).

### Install

```bash
npm install
cp .env.example .env
```

### Start the frontend

```bash
npm run dev
```

Default frontend URL:

- `http://localhost:5180`

### Start the local server entrypoint

```bash
npm run dev:server
```

Default local server URL:

- `http://localhost:5001`

### Firebase emulators

```bash
npm run firebase:emulators
```

## Environment Setup

Use [.env.example](./.env.example) as the base reference.

Client-side variables typically include:

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
```

Firebase Functions runtime variables should live under:

- `src/functions/.env.<project-or-alias>`

Typical function runtime keys include:

```env
SITE_URL=
CORS_ALLOWED_ORIGINS=
WEBAUTHN_RP_ID=
WEBAUTHN_ALLOWED_ORIGINS=
CONTACT_RATE_LIMIT_MAX_PER_MINUTE=
FRONTEND_GATE_MAX_ATTEMPTS_PER_MINUTE=
FCM_BRIDGE_SIGNING_SECRET=
FRONTEND_GATE_PASSWORD=
FRONTEND_GATE_SESSION_SECRET=
```

Do not put server secrets in `VITE_*` variables.

## Common Commands

Daily development:

- `npm run dev`
- `npm run dev:server`
- `npm run preview`
- `npm run firebase:emulators`

Validation:

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run test:e2e`
- `npm run memory:check`

Content and generated artifacts:

- `npm run offline:inventory`
- `npm run seo:generate`
- `npm run seed:cms:blog`
- `npm run sync:cms:blog:summaries`

Deploy:

- `npm run deploy`
- `npm run deploy:hosting`
- `npm run deploy:rules`
- `npm run deploy:indexes`

## Deployment Notes

This repo is set up for Firebase deployment:

- Hosting config lives in [firebase.json](./firebase.json)
- Functions source is `src/functions`
- Firestore rules and indexes are tracked in:
  - [firestore.rules](./firestore.rules)
  - [firestore.indexes.json](./firestore.indexes.json)
- Storage rules live in [storage.rules](./storage.rules)

GitHub Actions-based Firebase deployment may also be configured in:

- [.github/workflows/](./.github/workflows)

## Contributor Workflow

Before making architectural or data-flow changes, read:

- [workflow/source-of-truth.md](./workflow/source-of-truth.md)
- [workflow/feature-playbooks.md](./workflow/feature-playbooks.md)
- [workflow/mutation-and-data-rules.md](./workflow/mutation-and-data-rules.md)
- [workflow/testing-matrix.md](./workflow/testing-matrix.md)
- [workflow/security-checklists.md](./workflow/security-checklists.md)

For repo-wide contributor guidance, see:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)

## Validation Baseline

For most changes, the preferred minimum sequence is:

```bash
npm run lint
npm run test:run
npm run build
```

Run `npm run test:e2e` when routing, auth flows, or major UX surfaces are affected.
