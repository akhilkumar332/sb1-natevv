# Contributing To BloodHub India

## Before You Start

This is a production-oriented Firebase application with multiple role-based portals and operational dashboards. Favor correctness, scoped changes, and low-regression work over broad refactors.

Read these first:

- [README.md](./README.md)
- [workflow/source-of-truth.md](./workflow/source-of-truth.md)
- [workflow/feature-playbooks.md](./workflow/feature-playbooks.md)
- [workflow/mutation-and-data-rules.md](./workflow/mutation-and-data-rules.md)
- [workflow/testing-matrix.md](./workflow/testing-matrix.md)
- [workflow/security-checklists.md](./workflow/security-checklists.md)

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Useful local commands:

```bash
npm run dev:server
npm run firebase:emulators
```

## Contribution Principles

- keep changes focused and reversible
- do not mix unrelated cleanup into feature or bug-fix work
- preserve route/constants/service layering
- prefer existing hooks, services, constants, and providers over new parallel patterns
- do not commit secrets or local env files

## Repository Conventions

Follow the established structure:

- pages compose screens and route state
- components render UI
- hooks coordinate data loading and behavior
- services handle Firestore, backend, and operational interaction
- constants and utils centralize shared logic

Important source-of-truth locations:

- routes: `src/constants/routes.ts`, `src/AppRoutes.tsx`
- backend endpoints: `src/constants/backend.ts`
- Firestore collections: `src/constants/firestore.ts`
- offline policy: `src/constants/offline*.ts`, `src/services/offlineMutationOutbox.service.ts`
- Firebase Functions: `src/functions/`

## High-Risk Change Areas

Extra care is required when touching:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`
- `src/functions/`
- auth/session handling
- admin and superadmin flows
- offline mutation and sync health
- CMS write paths
- error logging and operational diagnostics

## Documentation Expectations

Update docs when a change affects:

- deployment steps
- environment variables
- backend endpoints
- admin workflows
- offline behavior
- security posture
- data model assumptions

Check `docs/` first before adding a new plan file; there is often existing project-specific context already.

## Testing Expectations

Baseline validation for most changes:

```bash
npm run lint
npm run test:run
npm run build
```

Run broader checks when relevant:

```bash
npm run test:e2e
npm run offline:inventory
npm run memory:check
```

Use [workflow/testing-matrix.md](./workflow/testing-matrix.md) to decide the minimum required validation for your change type.

## Pull Request Guidance

A good PR should include:

- clear summary of what changed
- why the change was needed
- user or operator impact
- any rule/index/schema implications
- testing performed
- screenshots for visible UI changes when relevant

## Secrets And Safety

- never commit `.env*` files with real values
- keep Firebase Admin credentials server-side only
- do not expose server secrets through `VITE_*`
- sanitize logs, screenshots, and fixtures before sharing

For sensitive work, review:

- [SECURITY.md](./SECURITY.md)
- [workflow/security-checklists.md](./workflow/security-checklists.md)

## Commit Guidance

Prefer short, imperative commit messages scoped to one change. Keep commits atomic when possible.

Examples:

- `Fix frontend access cookie handling`
- `Update Firebase deploy workflow`
- `Remove unused Swagger dependencies`

## License Note

No project license file is currently present. Coordinate with the repository owner before contributing code intended for public redistribution.
