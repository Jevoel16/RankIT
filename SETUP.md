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
- `npm run dev` fails under concurrently with `nodemon` or `react-scripts` not recognized:
  - App-level dependencies are missing (backend/frontend node_modules were removed or not installed)
  - Run: `npm run install:all`
