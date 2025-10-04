# Deployment Guide - Bloodhub India

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Firebase Configuration](#firebase-configuration)
- [Deployment Methods](#deployment-methods)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Node.js >= 20.x
- npm >= 10.x
- Firebase CLI >= 13.x
- Git

### Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Login to Firebase
```bash
firebase login
```

## Environment Setup

### 1. Environment Variables

Create environment files for different stages:

**Development (`.env`):**
```bash
# Copy from .env.example
cp .env.example .env

# Update with development Firebase config
VITE_FIREBASE_API_KEY=your_dev_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_dev_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_dev_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_dev_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_dev_sender_id
VITE_FIREBASE_APP_ID=your_dev_app_id
```

**Production (`.env.production`):**
```bash
# Already configured with production credentials
# DO NOT commit to version control
VITE_FIREBASE_API_KEY=AIzaSyAIJiGaZS0icMV0MGgTSfqW9inuQeqg2gs
VITE_FIREBASE_AUTH_DOMAIN=bloodhubindia-1da2a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bloodhubindia-1da2a
VITE_FIREBASE_STORAGE_BUCKET=bloodhubindia-1da2a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=663079878536
VITE_FIREBASE_APP_ID=1:663079878536:web:18e1b65bbfba558901043d
```

### 2. GitHub Secrets (for CI/CD)

Add the following secrets to your GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Add these secrets:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT (JSON from Firebase Console)
```

## Firebase Configuration

### 1. Initialize Firebase Project

```bash
# Already configured, but for reference:
firebase init

# Select:
# - Hosting
# - Firestore
# - Storage
```

### 2. Deploy Security Rules

```bash
# Deploy Firestore rules
npm run deploy:rules

# Deploy Firestore indexes
npm run deploy:indexes
```

### 3. Verify Firebase Configuration

```bash
# List projects
firebase projects:list

# Use specific project
firebase use bloodhubindia-1da2a
```

## Deployment Methods

### Method 1: Manual Deployment

#### Build for Production
```bash
npm run build:prod
```

#### Deploy to Firebase Hosting
```bash
# Deploy everything
npm run deploy

# Deploy hosting only
npm run deploy:hosting

# Deploy with preview channel (staging)
firebase hosting:channel:deploy staging
```

### Method 2: Automated Deployment (GitHub Actions)

The CI/CD pipeline automatically deploys when:
- Push to `main` branch
- All tests pass
- Build succeeds

**Pipeline Flow:**
1. Lint & TypeScript check
2. Run unit tests
3. Run E2E tests
4. Build application
5. Deploy to Firebase Hosting

### Method 3: Local Testing with Firebase Emulators

```bash
# Start emulators
npm run firebase:emulators

# Access:
# - Hosting: http://localhost:5000
# - Firestore: http://localhost:8080
# - Auth: http://localhost:9099
# - Emulator UI: http://localhost:4000
```

## CI/CD Pipeline

### GitHub Actions Workflow

Located at: `.github/workflows/ci.yml`

**Jobs:**
1. **lint-and-typecheck** - Code quality checks
2. **test** - Unit and integration tests
3. **e2e** - End-to-end tests
4. **build** - Production build
5. **lighthouse** - Performance audit
6. **deploy** - Firebase deployment (main branch only)

### Deployment Triggers

**Automatic Deployment:**
- Push to `main` branch → Production deployment

**Manual Deployment:**
```bash
# Trigger via GitHub Actions UI
# Or use Firebase CLI
npm run deploy
```

### Rollback Strategy

**Option 1: Firebase Hosting Rollback**
```bash
# List previous releases
firebase hosting:clone

# Rollback to previous version
firebase hosting:rollback
```

**Option 2: Redeploy Previous Commit**
```bash
# Checkout previous commit
git checkout <commit-hash>

# Deploy
npm run deploy

# Return to main
git checkout main
```

## Build Optimization

### Production Build Features

1. **Code Splitting**
   - Vendor chunks (React, Firebase, UI libraries)
   - Route-based code splitting
   - Analytics components lazy loaded

2. **Minification**
   - Terser for JavaScript
   - Drop console.logs in production
   - Remove debugger statements

3. **Caching Strategy**
   - Static assets: 1 year cache
   - HTML/JSON: No cache, must-revalidate
   - Versioned file names

4. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin

## Monitoring & Maintenance

### Performance Monitoring

**Core Web Vitals Tracking:**
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

**Access Metrics:**
```bash
# Firebase Console → Hosting → Performance
# Or use monitoring service integration
```

### Error Tracking

**Monitoring Service Integration:**
- Service: `src/services/monitoring.service.ts`
- Tracks: Errors, performance, analytics
- Production only (configurable)

**Enable in Production:**
```bash
# Set environment variables
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ANALYTICS=true

# Optional: Configure Sentry
VITE_SENTRY_DSN=your_sentry_dsn

# Optional: Configure Google Analytics
VITE_GA_TRACKING_ID=your_ga_tracking_id
```

### Analytics

**Track Events:**
- Page views
- User interactions
- API performance
- Error occurrences

**Implementation:**
```typescript
import { monitoringService } from './services/monitoring.service';

// Track event
monitoringService.trackEvent('donation_completed', {
  bloodType: 'O+',
  units: 1,
});

// Track page view
monitoringService.trackPageView('/dashboard');

// Monitor API call
monitoringService.monitorAPICall('/api/donations', 150, 200);
```

## Deployment Checklist

### Pre-Deployment
- [ ] Run all tests: `npm run test:run`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Check TypeScript: `npx tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Build locally: `npm run build:prod`
- [ ] Test build: `npm run preview`
- [ ] Review security rules
- [ ] Update environment variables
- [ ] Backup production data (if needed)

### Deployment
- [ ] Deploy security rules: `npm run deploy:rules`
- [ ] Deploy indexes: `npm run deploy:indexes`
- [ ] Deploy hosting: `npm run deploy:hosting`
- [ ] Verify deployment URL
- [ ] Check Firebase Console

### Post-Deployment
- [ ] Test critical user flows
- [ ] Verify authentication works
- [ ] Check data persistence
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify security rules
- [ ] Test mobile responsiveness
- [ ] Verify analytics tracking

## Troubleshooting

### Common Issues

**1. Build Fails**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit
```

**2. Firebase Deploy Fails**
```bash
# Login again
firebase login --reauth

# Check project
firebase use bloodhubindia-1da2a

# Deploy with debug
firebase deploy --debug
```

**3. Environment Variables Not Working**
```bash
# Ensure .env.production exists
ls -la .env.production

# Check Vite prefix (must start with VITE_)
# Rebuild after changes
npm run build:prod
```

**4. Security Rules Error**
```bash
# Test rules locally
firebase emulators:start

# Validate rules
firebase firestore:rules:validate firestore.rules
```

**5. Performance Issues**
```bash
# Analyze bundle size
npm run build:prod

# Check dist folder
du -sh dist/*

# Lighthouse audit
npm install -g @lhci/cli
lhci autorun
```

### Health Check Endpoints

**Application Health:**
- Production: https://bloodhubindia-1da2a.web.app
- Staging: https://bloodhubindia-1da2a--staging.web.app

**Firebase Services:**
- Console: https://console.firebase.google.com/project/bloodhubindia-1da2a
- Hosting: https://console.firebase.google.com/project/bloodhubindia-1da2a/hosting
- Firestore: https://console.firebase.google.com/project/bloodhubindia-1da2a/firestore

## Security Considerations

### Production Security

1. **Environment Variables**
   - Never commit `.env` files
   - Use GitHub Secrets for CI/CD
   - Rotate keys periodically

2. **Firebase Security Rules**
   - Reviewed and tested
   - Principle of least privilege
   - Role-based access control

3. **HTTPS Only**
   - Enforced by Firebase Hosting
   - Automatic redirects

4. **Content Security**
   - Security headers configured
   - XSS protection enabled
   - Frame options set

### Backup Strategy

**Firestore Backup:**
```bash
# Export data
gcloud firestore export gs://bloodhubindia-1da2a-backup

# Import data
gcloud firestore import gs://bloodhubindia-1da2a-backup
```

**Storage Backup:**
```bash
# Using gsutil
gsutil -m cp -r gs://bloodhubindia-1da2a.appspot.com gs://bloodhubindia-backup
```

## Support & Resources

**Documentation:**
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

**Monitoring:**
- Firebase Console: https://console.firebase.google.com
- GitHub Actions: https://github.com/[org]/[repo]/actions

**Team Contacts:**
- DevOps: devops@bloodhubindia.com
- Support: support@bloodhubindia.com
- Emergency: emergency@bloodhubindia.com

---

**Last Updated:** October 4, 2025
**Version:** 1.0.0
**Maintained By:** Bloodhub India Development Team
