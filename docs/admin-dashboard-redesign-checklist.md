# Admin Dashboard Redesign Checklist

This checklist is phased to avoid breaking existing functionality.

## Phase 1 - Safe foundation

- [x] Add audit entry to admin dashboard tab/menu.
  - File: `src/pages/admin/AdminPortal.tsx`
- [x] Add route alias for dashboard-scoped impersonation audit.
  - File: `src/AppRoutes.tsx`
- [x] Add pagination for large impersonation audit datasets.
  - File: `src/pages/admin/ImpersonationAudit.tsx`
- [x] Verify lint on touched files.

## Phase 2 - Route-based admin shell (non-breaking migration)

- [x] Create admin dashboard layout shell with desktop/mobile menu and nested outlet.
  - New file: `src/pages/admin/AdminPortal.tsx`
- [x] Add nested admin routes under `/admin/dashboard/*` while preserving current route behavior.
  - File: `src/AppRoutes.tsx`
- [x] Remove legacy dashboard route/menu after migration hardening.
  - Files: `src/AppRoutes.tsx`, `src/pages/admin/AdminPortal.tsx`, `src/pages/admin/dashboard/Settings.tsx`

## Phase 3 - Split existing tabs into page routes

- [x] Create page: overview
  - New file: `src/pages/admin/dashboard/Overview.tsx`
- [x] Create page: user management
  - New file: `src/pages/admin/dashboard/Users.tsx`
- [x] Create page: verification
  - New file: `src/pages/admin/dashboard/Verification.tsx`
- [x] Create page: emergency requests
  - New file: `src/pages/admin/dashboard/EmergencyRequests.tsx`
- [x] Create page: reports and analytics
  - New file: `src/pages/admin/dashboard/AnalyticsReports.tsx`
  - Route alias: `/admin/dashboard/reports -> /admin/dashboard/analytics-reports`
- [x] Create page: impersonation audit route entry
  - Route directly wired to existing page: `src/pages/admin/ImpersonationAudit.tsx`

## Phase 4 - Complete admin management coverage

- [x] Donor management page and actions (status, suspend/reactivate, details).
  - New file: `src/pages/admin/dashboard/Donors.tsx`
  - Update file: `src/services/admin.service.ts`
- [x] NGO management page and actions.
  - New file: `src/pages/admin/dashboard/Ngos.tsx`
  - Update file: `src/services/admin.service.ts`
- [x] BloodBank management page and actions.
  - New file: `src/pages/admin/dashboard/BloodBanks.tsx`
  - Update file: `src/services/admin.service.ts`
- [x] Wire real actions for verification approvals/rejections using existing components.
  - Files: `src/components/admin/VerificationCard.tsx`, `src/components/admin/DocumentViewer.tsx`, `src/pages/admin/dashboard/Verification.tsx`

## Phase 5 - Shared scalability features across admin pages

- [x] Reusable pagination controls for large lists.
  - New file: `src/components/admin/AdminPagination.tsx`
- [x] Reusable list toolbar (search/filter/page size).
  - New file: `src/components/admin/AdminListToolbar.tsx`
- [x] Apply paginated query patterns to users, verification requests, emergency requests, alerts, and impersonation audit events.
  - Files: `src/pages/admin/dashboard/*.tsx`, `src/pages/admin/ImpersonationAudit.tsx`

## Phase 6 - Hardening and regression safety

- [x] Add unit tests for new admin list/pagination behavior.
  - New files: `src/pages/admin/__tests__/*.test.tsx`
- [x] Add route access tests for admin/superadmin pages.
  - New files: `src/__tests__/admin-routes.test.tsx`
- [x] Add e2e smoke for admin critical workflows.
  - New files: `e2e/admin-*.spec.ts`
- [x] Re-run lint and targeted tests before each phase completion.
