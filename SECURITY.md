# Security Policy

## Reporting a Vulnerability

Do not open public issues for security vulnerabilities.

Report vulnerabilities privately to the repository owner or designated maintainer with:

- affected area
- impact summary
- reproduction steps
- proof-of-concept details if available
- suggested mitigation if known

## Sensitive Areas in This Repository

- Firebase Authentication
- Firestore security rules
- Storage rules
- admin impersonation and audit flows
- notifications and FCM bridge endpoints
- environment variables and Firebase Admin credentials
- offline queue processing and admin operational dashboards

## Handling Expectations

- Validate the issue in a non-production environment first.
- Minimize data exposure during reproduction.
- Avoid sharing secrets, user records, or live access tokens in reports.
- Coordinate remediation and deployment before public disclosure.

## Operational Guidance

- Rotate credentials immediately if exposure is suspected.
- Review Firestore and Storage rules for permission regressions.
- Recheck admin-only surfaces after auth or role changes.
- Re-run lint, tests, and production build after security fixes.
