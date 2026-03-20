# RankIT Backend (backend)

This backend is an Express + MongoDB API for RankIT.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT auth and role-based authorization

## Environment

Create backend/.env:

PORT=5000
MONGODB_URI=mongodb://localhost:27017/RankIT_DB
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

## Main API Groups

- /api/users
- /api/events
- /api/contestants
- /api/tallies
- /api/audits
- /api/analytics
- /api/public

## Notes

- Public community route is exposed at /api/public/leaderboard (no auth).
- Role creation restrictions are enforced server-side.
- Event status is used for community LIVE/FINAL display.
