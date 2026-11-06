<div align="center">
  <img src="frontend-react/public/logo192.png" alt="RankIT logo" width="80">
  <h1>RankIT</h1>
  <p>Live, role-based tabulation and rankings for school events.</p>

[![Version](https://img.shields.io/badge/version-2.5.2-blue?style=flat)](backend/package.json)
[![License](https://img.shields.io/badge/license-Sprucetrap%20Source--Available-lightgrey?style=flat)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Jevoel16/RankIT/ci.yml?branch=V2.0-RankIT&label=CI&style=flat)](https://github.com/Jevoel16/RankIT/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-web-informational?style=flat)](#getting-started)

</div>

---

## About

RankIT runs the scoring side of school competitions: admins set up events and criteria, tabulators record judges' scores, grievance officers file deductions, and everyone else watches live rankings on a public page. It replaces spreadsheets passed between judges with one auditable system that computes event, category and overall weighted rankings and prints the official reports.

[Back to top](#rankit)

---

## Features

- Public live leaderboard by event, category and overall weighted ranking
- Big-screen display mode for projectors, with auto-rotating views and a QR code
- Role consoles for superadmin, admin, tabulator and grievance staff, built for phones and tablets
- Criteria-based and set-based (sports) scoring with automatic rankings
- Auditable grievance deductions with reasons
- Master report PDFs: main results, deduction notes, weighted rankings
- Audit trail and analytics for superadmins
- Light, dark and system themes; works on phones and tablets

[Back to top](#rankit)

---

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 19.3.1, React Router 6.30.6, Vite 6.4.5, @react-pdf/renderer 4.9.0, qrcode 1.5.4 |
| Backend | Node.js 22.14.0, Express 5.2.1, Mongoose 9.12.0, Zod 4.6.7, Helmet 8.3.0 |
| Database | MongoDB (Atlas in production) |
| Testing | Vitest 4.1.12, Supertest, mongodb-memory-server |
| Hosting | Vercel (web + API), MongoDB Atlas |

[Back to top](#rankit)

---

## Getting Started

Prerequisites: Node.js 22+, and MongoDB running locally (or an Atlas URI).

```bash
cp backend/.env.example backend/.env           # then set JWT_SECRET
npm ci --prefix backend && npm ci --prefix frontend-react
npm run seed:users --prefix backend && npm run seed:events --prefix backend
npm run dev --prefix backend                   # API on http://localhost:5000
npm start --prefix frontend-react              # app on http://localhost:3000
```

The seeders create demo accounts such as `mark@admin.rankit` and `al@tabulator.rankit` with the password from `SEED_PASSWORD` (default `1234`). They only run against a local database.

[Back to top](#rankit)

---

## Configuration

The API reads `backend/.env`; see [`backend/.env.example`](backend/.env.example). The frontend needs no variables in development: Vite proxies `/api` to the API.

<details>
<summary><b>Environment variables</b></summary>

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | backend | MongoDB connection string |
| `JWT_SECRET` | backend | Signs session cookies; use a long random value |
| `JWT_EXPIRES_IN` | backend | Session length, e.g. `12h` |
| `CORS_ORIGIN` | backend | Allowed browser origins (required in production) |
| `PORT`, `HOST` | backend | Local server bind (default `5000`, `0.0.0.0`) |
| `SEED_PASSWORD` | backend | Demo password for the local seeders |
| `VITE_DEV_API_TARGET` | frontend | Where the dev proxy sends `/api` (default `http://localhost:5000`) |
| `VITE_API_URL` | frontend | Only if the API is on another origin (default `/api`) |

</details>

[Back to top](#rankit)

---

## Usage

1. **Admin** creates an event with its criteria (or sets for sports), adds contestants and assigns a tabulator.
2. **Tabulator** records each judge's scores; rankings update immediately.
3. **Grievance** files deductions with a reason when a rule is broken.
4. **Everyone** follows the public page at `/`; admins choose which events and ranking views are visible. Put `/display` (or `/display/<eventId>`) on a projector: it rotates event, category and overall standings every 15 seconds (`?seconds=20`, `?rotate=0` to pin). Press F for full screen, Space to pause.
5. **Admin** prints the master report when the event is finalized.

Deploying: see [docs/deployment.md](docs/deployment.md).

[Back to top](#rankit)

---

## More

<details>
<summary><b>Project structure</b></summary>

```
backend/          Express API: routes, controllers, models, validation, tests, seed scripts
frontend-react/   React app: pages, components (ui kit), hooks, styles
docs/             Deployment guide
.github/          CI workflow
```

</details>

<details>
<summary><b>Scripts</b></summary>

| Package | Script | Does |
|---|---|---|
| backend | `npm run dev` | API with auto-reload |
| backend | `npm test` | API tests (in-memory MongoDB) |
| backend | `npm run lint` | ESLint |
| backend | `npm run seed:users` / `seed:events` | Local demo data |
| backend | `npm run create:superadmin` | First superadmin for any database |
| frontend-react | `npm start` | Dev server with `/api` proxy |
| frontend-react | `npm test` / `npm run lint` | Unit tests / ESLint |
| frontend-react | `npm run build` / `npm run preview` | Production build / serve it with production headers |

</details>

[Back to top](#rankit)

---

## Contributing

Work on a `feat/...` or `fix/...` branch and use Conventional Commits with the bumped version at the end of the subject, e.g. `feat: add CSV export (v2.5.0)`. Keep `npm run lint`, `npm test` and `npm run build` green, and update this README with every change.

[Back to top](#rankit)

---

## License

Source-available under the [Sprucetrap Source-Available License 1.0](LICENSE): free for non-commercial use with credit.

[Back to top](#rankit)

---

## Author

[Sprucetrap (@Jevoel16)](https://github.com/Jevoel16)

[Back to top](#rankit)
