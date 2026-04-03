# Contributing to BloodHub India

## Scope

This repository contains a production-oriented multi-portal blood donation platform. Contributions should prioritize stability, operational clarity, and data safety over broad refactors.

## Contribution Principles

- Keep changes scoped and reversible.
- Avoid unrelated refactors in feature or bug-fix branches.
- Preserve existing user flows unless the change explicitly updates them.
- Treat Firestore rules, indexes, offline behavior, and admin tooling as high-risk areas.
- Do not commit secrets, production credentials, or local environment files.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Use [README.md](README.md) for the full environment and platform overview.

## Branch and Change Expectations

- Use focused branches per feature or fix.
- Keep commits atomic and descriptive.
- If a build regenerates tracked assets, review them before committing.
- Do not revert unrelated working tree changes you did not create.

## Code Standards

- Use TypeScript and follow the existing project structure.
- Preserve established route, query, and service patterns.
- Prefer additive changes over risky rewrites.
- Keep UI changes consistent with the surrounding dashboard or portal surface.
- Add comments only when the logic is not self-evident.

## Testing Requirements

Run the standard verification suite before opening a PR:

```bash
npm run lint
npm run test:run
npm run build
```

Run additional targeted checks when relevant:

```bash
npm run test:e2e
npm run offline:inventory
npm run memory:check
```

## High-Risk Areas

Changes in the following areas require extra review discipline:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- authentication and role resolution
- admin services and query aggregation
- offline mutation outbox and sync health
- notifications and FCM bridge flows
- CMS write paths and content publishing behavior

## Pull Request Guidance

A strong PR should include:

- a clear problem statement
- the intended user or operator impact
- any Firestore rule, index, or data-shape changes
- screenshots for visible UI changes
- testing notes with exact commands run
- rollback considerations for risky changes

## Secrets and Environment Safety

- Never commit `.env` or production credential material.
- Keep Firebase Admin credentials server-side only.
- Do not expose server secrets through `VITE_` variables.
- Sanitize logs, screenshots, and test fixtures before sharing externally.

## Documentation Expectations

Update documentation when a change affects:

- environment variables
- deployment steps
- admin workflows
- offline behavior
- security posture
- data model assumptions

## License

No project license file is currently present. Coordinate with the repository owner before contributing code intended for public redistribution.
