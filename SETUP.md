# Local Setup Guide

## 1. Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or cloud)

## 2. Install Dependencies

From project root:

```bash
npm install
```

If needed, install inside each app too:

```bash
npm install --prefix backend
npm install --prefix frontend-react
```

## 3. Configure Environment Files

### Backend

Create `backend/.env`:

```env
PORT=5000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/RankIT_DB
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h
```

### Frontend

Create `frontend-react/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 4. Seed Initial Users

```bash
npm run seed:users --prefix backend
```

### Default Seeded Users (Domain-Based Format)

After seeding, use these credentials to log in. Usernames use the format `username@role.rankit`:

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `superadmin1@superadmin.rankit` | `1234` | Superadmin | Full system access |
| `admin1@admin.rankit` | `1234` | Admin | Can create/manage users and events |
| `tabulator1@tabulator.rankit` | `1234` | Tabulator | Gatekeeper; manages scoresheets & rankings |
| `tallier1@tallier.rankit` | `1234` | Tallier | Judge/scorer; submits scores |
| `grievance1@grievance.rankit` | `1234` | Grievance Committee | Files and reviews grievances |
| `pending1@tallier.rankit` | `1234` | Tallier (Pending) | Requires admin approval to access |

**Example Login Flow**:
1. Open `http://localhost:3000`
2. Click "Login" tab
3. Enter username: `admin1@admin.rankit`
4. Enter password: `1234`
5. Click "Login"

**For Other Devices on Network**:
Replace `localhost` with your machine's IP address (e.g., `http://192.168.1.100:3000`)

## 5. Run in Development

From root:

```bash
npm run dev
```

Expected:

- Frontend on `http://localhost:3000`
- API on `http://localhost:5000/api`

## 6. Run in Production Mode Locally

From root:

```bash
npm run prod
```

This will:

1. Build React frontend
2. Start backend in production mode
3. Serve built frontend from backend

Open:

- `http://localhost:5000`

## 7. Common Issues

- Port already in use:
  - Change `PORT` in `backend/.env`
- MongoDB connection error:
  - Verify `MONGODB_URI` and MongoDB service
- Frontend cannot call API:
  - Verify `REACT_APP_API_URL` in `frontend-react/.env`
- Other device cannot fetch API:
  - Use machine LAN IP instead of localhost for both frontend and REACT_APP_API_URL
  - Example frontend URL: `http://192.168.1.23:3000`
  - Example API URL: `http://192.168.1.23:5000/api`
  - Frontend now auto-rewrites localhost API config to current hostname when accessed remotely
  - Ensure Windows Firewall allows inbound TCP on ports 3000 and 5000
- `npm run dev` fails under concurrently with `nodemon` or `react-scripts` not recognized:
  - App-level dependencies are missing (backend/frontend node_modules were removed or not installed)
  - Run: `npm run install:all`
