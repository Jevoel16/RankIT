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
- Audit trail and analytics dashboards
- Admin JSON backup download
- Full-contestant Master Results PDF for tabulator/admin verification
- Deduction Notes PDF as separate sub-tab for detailed audit records
- Grievance Committee dashboard with audited deduction actions
- Vercel-ready frontend deployment setup

## Project Architecture

- frontend-react: React client (Create React App)
- backend: Express API with MongoDB
- root workspace: convenience scripts for local development and production-style runs

## Main Features

### Public Community View

- Public route at /
- No login required for audience access
- Top-3 podium with medal crown visuals
- Category and event filtering
- Live status badge (LIVE or FINAL)
- Real-time feel via periodic refresh

### Staff Modules

- Tallier: submit scores per contestant and criteria
- Tabulator: view progress, rankings, and assign judges (talliers) to their event
- Grievance Committee: view preliminary scores and apply contestant point deductions with reasons
- Admin: create events, assign tabulators via a dedicated tab, manage contestants/users, and download JSON backups
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
- Project context paragraph provided in ProjectContext.md

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
REACT_APP_API_URL=http://localhost:5000/api
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

### 3.1 Seed Dummy Events + Contestants + Users (Optional)

```bash
npm run seed:dummy --prefix backend
```

This seeds:

- 3 events: Dancing Showdown, Singing Idol, Talent Showcase
- 10 contestants per event (30 total)
- 6 approved demo users (password for all: 1234)
	- includes grievance committee role account
	- superadmin_demo
	- admin_demo
	- tabulator_demo
	- grievance_demo
	- tallier_dance
	- tallier_sing
	- tallier_talent

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
REACT_APP_API_URL=http://YOUR_PC_LAN_IP:5000/api
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
