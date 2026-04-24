# Security Policy

## Reporting A Vulnerability

Do not open public GitHub issues for security vulnerabilities.

Report security issues privately to the repository owner or designated maintainer with:

- affected area
- impact summary
- reproduction steps
- proof-of-concept details if needed
- mitigation ideas if already known

Include only the minimum data needed to reproduce the problem safely.

## Scope Of Sensitive Areas

High-sensitivity surfaces in this repository include:

- Firebase Authentication flows
- Firestore security rules in [firestore.rules](./firestore.rules)
- Storage rules in [storage.rules](./storage.rules)
- Firebase Functions under [src/functions/](./src/functions)
- admin and superadmin role checks
- impersonation and WebAuthn flows
- notification and FCM bridge endpoints
- offline mutation queueing and sync health
- environment variables and server-side credentials

## Current Security Model

The active deployment model is Firebase-based:

- Firebase Hosting
- Firebase Cloud Functions
- Firestore
- Firebase Storage

Security-sensitive backend logic runs in [src/functions/](./src/functions), not in client code.

## Responsible Disclosure Expectations

- validate findings against a non-production environment when possible
- avoid accessing or modifying real user data beyond what is strictly necessary
- do not include raw tokens, passwords, private keys, emails, or phone numbers in reports
- coordinate remediation before any public disclosure

## Secrets And Credentials

- never commit `.env`, `.env.local`, `src/functions/.env.*`, or service-account JSON files
- never expose server secrets through `VITE_*` variables
- keep Firebase Admin credentials and any signing secrets server-side only
- rotate credentials immediately if exposure is suspected

## Security Review Areas For Code Changes

Review carefully when changes touch:

- `firestore.rules`
- `storage.rules`
- `firebase.json`
- `src/functions/`
- auth/session handling
- admin/superadmin permissions
- file uploads
- offline write behavior for security-sensitive mutations

## Logging And Data Exposure

- prefer summaries over raw payloads
- redact tokens, passwords, emails, phone numbers, and sensitive query params
- avoid copying full request bodies or sensitive headers into logs
- sanitize metadata stored in error logs or diagnostics

## Security Validation After Fixes

After security-sensitive changes, the minimum recommended checks are:

```bash
npm run lint
npm run test:run
npm run build
```

Also re-check:

- Firestore rules behavior
- Storage rules behavior
- role-based UI and backend access
- Firebase Function input validation and auth checks

## Related Internal Guidance

Use the repo workflow docs for implementation review:

- [workflow/security-checklists.md](./workflow/security-checklists.md)
- [workflow/source-of-truth.md](./workflow/source-of-truth.md)
- [workflow/testing-matrix.md](./workflow/testing-matrix.md)

These files are the best starting point before changing authentication, rules, endpoints, or secret handling.
