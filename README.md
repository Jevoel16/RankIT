# RankIT

RankIT is a role-based event tabulation platform for school competitions.

It has:
- A public community page for live rankings
- A staff dashboard with role-based access (superadmin, admin, tabulator, grievance)
- Event setup, score recording, ranking computation, audit logs, and report exports

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB
- Auth: JWT

## What The App Is Expected To Do

### Public (no login)

- View event rankings
- View category rankings (when enabled by admin)
- View overall rankings (when enabled by admin)
- See event status and visible events only

### Admin

- Manage user approvals and manual user creation
- Create events (including criteria-based and sports flows)
- Assign tabulators to events
- Manage contestants
- Control community visibility/settings

### Superadmin

- Full user oversight (approval, create, users directory)
- View analytics dashboard
- View audit trail and export reports

### Tabulator

- Record offline scores
- Manage event scoring workflow
- Generate reports (including tabulation/master outputs)

### Grievance

- View grievance-related score context
- Apply deduction entries with reasons
- Keep deduction actions auditable

## Local Setup (Fresh Machine)

## 1. Prerequisites

- Node.js 18+
- npm 9+
- MongoDB running locally or a MongoDB Atlas URI

## 2. Configure Environment Variables

Create backend/.env:

```env
PORT=5000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/RankIT_DB
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h
```

Create frontend-react/.env:

```env
VITE_API_URL=http://localhost:5000/api
```

Notes:
- MONGODB_URI is required.
- If VITE_API_URL is missing, frontend falls back to current-host:5000/api.

## 3. Install Dependencies

In terminal 1:

```bash
cd backend
npm install
```

In terminal 2:

```bash
cd frontend-react
npm install
```

## 4. Optional Seed Data

From backend folder:

```bash
npm run seed:users
npm run seed:events
```

Default seeded password: 1234

Sample seeded usernames:
- jevoel@superadmin.rankit
- mark@admin.rankit
- al@tabulator.rankit
- kibra@grievance.rankit

## 5. Run The App

In backend folder:

```bash
npm run dev
```

In frontend-react folder:

```bash
npm start
```

Expected local URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## Quick Verification Checklist

- Backend starts and connects to MongoDB
- Frontend loads at / and shows Community page
- Login works with a seeded account
- Admin can create event and manage users
- Superadmin can open Analytics, User Oversight, and Audit Trail
- Tabulator can load assigned event scoring flow

## Common Issues

- API unreachable from frontend:
  - Check frontend-react/.env VITE_API_URL
  - Ensure backend is running on port 5000

- MongoDB connection error:
  - Verify MONGODB_URI in backend/.env
  - Verify MongoDB service/cluster access

- Access from another device on same network:
  - Use your PC LAN IP instead of localhost in VITE_API_URL
  - Open frontend via http://YOUR_LAN_IP:3000
  - Allow firewall inbound ports 3000 and 5000

## Project Structure

- backend: Express API, MongoDB models, controllers, routes, seed scripts
- frontend-react: React app, pages/components/hooks, report UI and exports

## Additional Docs

- SETUP.md
- BACKEND_README.md
- FRONTEND_README.md
- VERCEL_SETUP.md
- ITD110_CASE_STUDY_1_COMPLIANCE_CHECK.md
