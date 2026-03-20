# Vercel Setup Guide

This project is best deployed as:

- Frontend (`frontend-react`) on Vercel
- Backend (`backend`) on a Node host (Railway, Render, Fly.io, etc.)

Why: this backend is a long-running Express server with DB connection, which is not ideal for direct monolithic deployment on Vercel serverless without refactoring.

## Option A (Recommended): Frontend on Vercel + Backend on Separate Host

## 1. Deploy Backend First

Deploy `backend/` to your preferred Node host and set:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

After deploy, copy backend base URL (example):

- `https://rankit-api.example.com`

## 2. Deploy Frontend to Vercel

In Vercel:

1. Import repository
2. Set **Root Directory** to `frontend-react`
3. Framework preset: `Create React App`
4. Build command: `npm run build`
5. Output directory: `build`

Set environment variable in Vercel project:

- `REACT_APP_API_URL=https://rankit-api.example.com/api`

Deploy and open your Vercel URL.

## 3. Frontend Routing (SPA)

Create `frontend-react/vercel.json` if you need explicit SPA fallback:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## Option B (Advanced): Full Vercel Deployment

Possible but requires backend refactor to serverless API functions (for example `api/*.js`) and careful DB connection handling per invocation.

If you want this, we can do a separate migration step.

## Quick Checklist

- Backend reachable publicly
- CORS allows frontend domain
- `REACT_APP_API_URL` points to backend `/api`
- MongoDB URI uses production database
- JWT secret is strong and private
