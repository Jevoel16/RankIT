# RankIT

RankIT is a role-based event tabulation platform built with React, Express, and MongoDB. It supports secure scoring workflows for staff and a public Community View for live audience tracking.

## Highlights

- Role-based access for superadmin, admin, tabulator, and tallier
- Public Community leaderboard at /
- Live ranking updates via polling
- Gatekeeper logic for unlocking final rankings
- **Event Finalization & Winner Declaration** with comprehensive audit logging
- Hierarchical assignment flow (Admin -> Tabulator -> Tallier)
- Event and contestant management
- Literary event support with set-based scoring for debate-style competitions
- Tabulator-managed offline score recording with physical judge attribution
- Hierarchical weighted ranking (category totals + overall weighted champion)
- Audit trail and analytics dashboards
- Admin JSON backup download
- Full-contestant Master Results PDF for tabulator/admin verification
- Deduction Notes PDF as separate sub-tab for detailed audit records
- Grievance dashboard with audited deduction actions
- Vercel-ready frontend deployment setup

## Project Architecture

- frontend-react: React client (Create React App)
- backend: Express API with MongoDB
- root workspace: convenience scripts for local development and production-style runs

## Main Features

### Public Community View

- Public route at /
- No login required for audience access
- Unified control bubble for switching Event, Category, and Overall rankings
- Top-3 podium with medal crown visuals
- Category and event filtering in the same control panel
- Live status badge (LIVE or ENDED)
- Real-time feel via periodic refresh
- Category and overall tabs can be opened/locked by admin settings
- Event list includes only events marked visible to the community

### Staff Modules

- Tabulator: record offline scores per contestant and criteria with physical judge attribution
- Tabulator: view progress, rankings, and assign judges to their event
- Grievance: view preliminary scores and apply contestant point deductions with reasons
- Admin: create events, assign tabulators via a dedicated tab, manage contestants/users, and download JSON backups
- Admin: configure community access (event visibility, live/ended event status, category/overall ranking locks)
- Superadmin: approval flow, analytics, audits, and system oversight

### Hierarchical Assignment Workflow

- Admin assigns each event to one approved tabulator using event tabulator assignment.
- Tabulator assigns approved talliers (judges) to their own event via Manage Judges.
- Talliers can only view contestants and submit scores for events where they are assigned.
- Tabulators can only view result dashboards for events assigned to them.
- Assignment actions are stored in audit logs for JSON backup traceability.

### Compliance Features

- JSON backup export route: /api/admin/backup (admin protected)
- One-click backup download from Admin Settings
- Master PDF report route: /api/tallies/master/:eventId with audit action FULL_RESULTS_PDF_GENERATED
- Grievance deduction route: /api/contestants/:id/deduct with audit action SCORE_ALTERED_BY_GRIEVANCE
- Overall weighted ranking calculation is audit-logged as OVERALL_RANKINGS_CALCULATED
- Project context paragraph provided in ProjectContext.md

### Hierarchical Ranking Logic

- Category ranking: contestant final event scores are summed within a category to produce category totals.
- Overall ranking: each event rank is converted to weighted points using 1st=10, 2nd=7, 3rd=5, 4th=3, 5th=2, 6th=1, 7th=0.
- Overall champion: category points are averaged across the categories a contestant appears in using `(sum of category points) / number of categories`.
- Public home now includes separate tabs for event, category, and overall rankings.

### Ranking Endpoints

- GET /api/rankings/category/:categoryName (authenticated roles: admin, superadmin, tabulator, grievance)
- GET /api/rankings/overall (authenticated roles: admin, superadmin, tabulator, grievance)
- GET /api/public/rankings/category/:categoryName (public; availability controlled by admin lock setting)
- GET /api/public/overall-leaderboard (public)

### Community Access Endpoints

- GET /api/admin/community-access (admin/superadmin)
- PATCH /api/admin/community-access (admin/superadmin)
- PATCH /api/admin/community-access/events/:eventId (admin/superadmin)

### Security and Governance

- JWT authentication
- Role authorization middleware
- Approval workflows for user onboarding
- Server-side restrictions for privileged role creation
- Full user directory visibility is restricted to superadmin only

## Quick Start

### 1. Install Dependencies

From root:

```bash
npm run install:all
```

### 2. Configure Environment Files

Backend file: backend/.env

```env
PORT=5000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/RankIT_DB
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h
```

Frontend file: frontend-react/.env

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Seed Initial Users (Optional)

```bash
npm run seed:users --prefix backend
```

Default password: 1234

- superadmin1
- admin1
- tabulator1
- grievance1
- tallier1
- pending1

### 3.1 Seed Events + Contestants (Optional)

```bash
npm run seed:events --prefix backend
```

This seeds:

- Events and contestants only (no user seeding)
- Categories: Special Events Category, Literary Events Category, Sports Events Category
- Literary includes both Debate Showcase and Poetry Recitation
- Sports uses two-team setup (CCS vs CSM)

Run users seeding first so tabulator assignments are available:

```bash
npm run seed:users --prefix backend
```

### 4. Run in Development

```bash
npm run dev
```

Expected endpoints:

- Frontend: http://localhost:3000
- API: http://localhost:5000/api

## Root Scripts

- npm run install:all: install root, backend, and frontend dependencies
- npm run dev: run backend and frontend concurrently
- npm run prod: build frontend and run backend in production mode

## Deployment

Recommended deployment strategy:

- Frontend on Vercel
- Backend on a Node host (Render, Railway, Fly.io, etc.)

See deployment details in VERCEL_SETUP.md.

## Troubleshooting

### Cannot fetch from another device

If the app works on your PC but fails on phone/other laptop, use LAN settings instead of localhost.

1. Set frontend API URL to your machine IP in frontend-react/.env:

```env
VITE_API_URL=http://YOUR_PC_LAN_IP:5000/api
```

If this remains set to localhost, the app now auto-switches localhost to the current device host when accessed from another device.

2. Open frontend from other device using LAN IP:

```text
http://YOUR_PC_LAN_IP:3000
```

3. Ensure backend is reachable on LAN (server binds to 0.0.0.0 by default).

4. Allow inbound ports 3000 and 5000 in Windows Firewall (Private network).

5. Keep both devices on the same Wi-Fi/LAN.

### npm run dev fails under concurrently

If you see errors such as nodemon not recognized or react-scripts not recognized, dependencies are missing in one or both app folders.

Fix:

```bash
npm run install:all
```

### webpack-dev-server client path error on Windows paths

The frontend includes a postinstall patch script to handle path issues with webpack-dev-server. If dependencies were removed and reinstalled, rerun install to ensure patch application.

## Documentation Map

- SETUP.md: local setup guide
- BACKEND_README.md: backend-specific guide
- FRONTEND_README.md: frontend-specific guide
- BACKEND_STRUCTURE_EXPLANATION.md: per-file explanation for backend controllers, middleware, models, and routes
- FRONTEND_STRUCTURE_EXPLANATION.md: per-file explanation for frontend components, hooks, pages, api.js, and App.js
- ProjectContext.md: one-paragraph case study context
- ITD110_CASE_STUDY_1_COMPLIANCE_CHECK.md: requirement-by-requirement compliance status
- VERCEL_SETUP.md: deployment guide
