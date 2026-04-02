# RankIT Backend (backend)

This backend is an Express + MongoDB API for RankIT.

## Stack


## Authentication System: Domain-Based Identity Format
## Environment
RankIT implements a domain-based authentication system where user identities follow the format `username@role.rankit`. This approach:

- Automatically formats usernames during registration and user creation
- Prevents username conflicts across different roles (same person can have different accounts per role)
- Embeds role information directly in the identity for improved auditability
- Uses Mongoose pre-save middleware to ensure consistent formatting
Create backend/.env:
**Supported Roles**:
- `superadmin.rankit`
- `admin.rankit`
- `tabulator.rankit`
- `tallier.rankit`
- `grievancecommittee.rankit`

**Related Authentication Endpoints**:
- `POST /api/users/register` - User self-registration (username auto-formatted)
- `POST /api/users/login` - Login with domain format (e.g., `admin1@admin.rankit`)
- `POST /api/users/admin-create` - Admin user creation (domain format applied)
PORT=5000
**Audit Logging**:
- `USER_REGISTERED` - Tracks new user registrations with identityFormat metadata
- `USER_LOGGED_IN` - Logs successful logins with role and timestamp
- `ADMIN_CREATED_USER` - Logs admin-created accounts with approval bypass flag
MONGODB_URI=mongodb://localhost:27017/RankIT_DB
See [DOMAIN_AUTHENTICATION_IMPLEMENTATION.md](./DOMAIN_AUTHENTICATION_IMPLEMENTATION.md) for comprehensive implementation details.
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h

## Install

From project root:

npm install --prefix backend

Or install everything:

npm run install:all

## Run

From project root:

npm run dev --prefix backend

Or from backend folder:

npm run dev

Production mode:

npm run start:prod

## Scripts

- npm run dev: Start with nodemon
- npm run start: Start with node
- npm run start:prod: Start with NODE_ENV=production
- npm run seed:users: Seed default users
- npm run seed:dummy: Seed 3 demo events, 10 contestants per event, and demo users

## Demo Seeding

Run from project root:

npm run seed:dummy --prefix backend

Seeds include:

- Events: Dancing Showdown, Singing Idol, Talent Showcase
- Contestants: 10 contestants per event
- Users (password: 1234): superadmin_demo@superadmin.rankit, admin_demo@admin.rankit, tabulator_demo@tabulator.rankit, grievance_demo@grievancecommittee.rankit, tallier_dance@tallier.rankit, tallier_sing@tallier.rankit, tallier_talent@tallier.rankit

## Main API Groups

- /api/users
- /api/events
- /api/contestants
- /api/tallies
- /api/audits
- /api/analytics
- /api/admin
- /api/public
- /api/assignments

Additional tally endpoint:

- /api/tallies/mine/:eventId (tallier-only score sheet for print/export use)
- /api/tallies/master/:eventId (admin/assigned-tabulator full event results for PDF generation)
	- Response includes generatedByName and generatedByRole for report identity labeling.

Grievance endpoint:

- PATCH /api/contestants/:id/deduct (grievancecommittee role only)
	- Adds a grievance entry (`reason`, `deductionPoints`, `filedBy`, `timestamp`) to the contestant.
	- Logs audit action `SCORE_ALTERED_BY_GRIEVANCE`.

## Assignment Workflow (RBAC)

- Event documents include tabulatorId and assignedTallierIds.
- Admin/Superadmin can assign a tabulator to an event.
- Assigned tabulator can assign approved talliers to that event.
- Tallier scoring and Tabulator result access are protected by assignment-aware middleware checks.
- Assignment audit actions are logged as EVENT_TABULATOR_ASSIGNED and EVENT_TALLIER_ASSIGNED.
- Master PDF report generation is logged as FULL_RESULTS_PDF_GENERATED.
- Tabulator dashboard aggregation endpoint returns activeTalliers vs totalAssignedTalliers per assigned event.

## Notes

- Public community route is exposed at /api/public/leaderboard (no auth).
- JSON backup export route is exposed at /api/admin/backup (admin only).
- Production requests are upgraded to HTTPS and HSTS is applied.
- JSON backup export includes audit logs for system traceability.
- Role creation restrictions are enforced server-side.
- Event status is used for community LIVE/FINAL display.
- Full user directory endpoint (/api/users GET) is superadmin-only.
- Ranking pipelines now subtract contestant grievance deduction totals before final ranking output.
