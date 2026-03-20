# RankIT

RankIT is a role-based tabulation system with separate experiences for:

- `superadmin`
- `admin`
- `tallier`
- `tabulator`

## Project Structure

- `backend/` - Express + MongoDB API
- `frontend-react/` - React client
- `package.json` (root) - workspace scripts for running both services

## Scripts

From the project root:

- `npm run dev` - Runs backend + frontend in development mode
- `npm run prod` - Builds frontend, then runs backend in production mode (backend serves frontend build)

## Default URLs

- Development frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api`
- Production app URL: `http://localhost:5000` (or `PORT` from backend `.env`)

## Environment Variables

Backend (`backend/.env`):

- `PORT=5000`
- `MONGODB_URI=mongodb://localhost:27017/RankIT_DB`
- `JWT_SECRET=change-this-secret`
- `JWT_EXPIRES_IN=12h`

Frontend (`frontend-react/.env`):

- `REACT_APP_API_URL=http://localhost:5000/api`

## Seed Users

Run from `backend/`:

```bash
npm run seed:users
```

Default seeded credentials (password for all): `1234`

- `superadmin1`
- `admin1`
- `tabulator1`
- `tallier1`
- `pending1`

See setup details in `SETUP.md`, backend details in `BACKEND_README.md`, frontend details in `FRONTEND_README.md`, and Vercel deployment in `VERCEL_SETUP.md`.
