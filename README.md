# RankIT

RankIT is a role-based event tabulation platform built with React, Express, and MongoDB. It supports secure scoring workflows for staff and a public Community View for live audience tracking.

## Highlights

- Role-based access for superadmin, admin, tabulator, and tallier
- Public Community leaderboard at /
- Live ranking updates via polling
- Gatekeeper logic for unlocking final rankings
- Event and contestant management
- Audit trail and analytics dashboards
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
- Tabulator: view progress and rankings
- Admin: create events and manage contestants/users
- Superadmin: approval flow, analytics, audits, and system oversight

### Security and Governance

- JWT authentication
- Role authorization middleware
- Approval workflows for user onboarding
- Server-side restrictions for privileged role creation

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
- tallier1
- pending1

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
- VERCEL_SETUP.md: deployment guide
