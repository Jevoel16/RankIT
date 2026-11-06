# Deploying RankIT (Vercel + MongoDB Atlas)

RankIT deploys as **two Vercel projects from the same GitHub repository** plus a MongoDB Atlas cluster:

| Piece | Vercel project | Root directory | What it serves |
|---|---|---|---|
| API | `rankit-api` | `backend` | Express API as one serverless function (`api/index.js`) |
| Web | `rankit` | `frontend-react` | Static Vite build; `/api/*` is rewritten to `rankit-api` |

The web project proxies `/api/*` to the API project, so the browser only ever talks to one origin. That keeps the
`httpOnly` session cookie first-party (`SameSite=Lax`) and avoids third-party cookie blocking.

Vercel's Git integration builds every push: pushes to the production branch go live, other branches get preview
URLs. CI (`.github/workflows/ci.yml`) runs lint, tests, build and `npm audit` on the same pushes.

---

## 1. MongoDB Atlas

1. Create a cluster (M0 free or Flex). Pick the region closest to your Vercel function region (step 2).
2. **Database Access** → add a database user with the built-in role `readWrite` on database `RankIT_DB` only.
   Use a generated password.
3. **Network Access** → add `0.0.0.0/0`. Vercel functions don't have fixed IPs, so either allow all and rely on
   the strong DB password, or install the [Vercel ↔ Atlas integration](https://vercel.com/integrations/mongodbatlas)
   which manages this for you.
4. **Connect → Drivers** → copy the SRV string and put the database name in it:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/RankIT_DB?retryWrites=true&w=majority`

## 2. API project (`rankit-api`)

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** `backend`. Framework preset: **Other**. Leave build and output settings empty.
3. **Settings → Functions → Region:** the same region as the Atlas cluster.
4. **Settings → Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | Atlas SRV string from step 1 |
   | `JWT_SECRET` | 64+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `JWT_EXPIRES_IN` | `12h` |
   | `CORS_ORIGIN` | `https://rankit.vercel.app` (your web URL; comma-separate extra origins) |
   | `NODE_ENV` | `production` |

5. Deploy. `https://rankit-api.vercel.app/api` should answer `{"message":"RankIT API is running"}`.

## 3. Web project (`rankit`)

1. Import the same repo again as a second project.
2. **Root Directory:** `frontend-react`. Framework preset: **Vite** (build `npm run build`, output `build`, both
   already set in `frontend-react/vercel.json`).
3. If your API project URL isn't `https://rankit-api.vercel.app`, change the first rewrite destination in
   `frontend-react/vercel.json` and commit it. Vercel rewrites can't read environment variables.
4. No environment variables are needed. `VITE_API_URL` defaults to `/api`.
5. Deploy and open the site. Security headers (CSP, HSTS, `X-Frame-Options`, ...) come from `vercel.json`;
   run `npm run build && npm run preview` locally to test the same headers.

## 4. First superadmin

Never run `seed:users` / `seed:events` against production: they use a shared demo password and reset data
(the scripts refuse non-local databases unless forced). Create the first account instead:

```bash
cd backend
MONGODB_URI="<atlas SRV string>" npm run create:superadmin
```

It prompts for a username and a password (12+ characters), hashes it, and prints the login name
(`<name>@superadmin.rankit`). Sign in, then create admins from the Superadmin console.

## 5. Smoke test before announcing

On a preview URL first, then production:

- Public page loads and shows rankings (or "Stay tuned").
- Staff sign in works for each role; DevTools → Application → Cookies shows `rankit_session` as `HttpOnly`,
  `Secure`, `SameSite=Lax`, and Local Storage has no token.
- Record a score as a tabulator, file a deduction as grievance, and download a Master Report PDF as admin.
- Six wrong passwords in a row return "Too many login attempts".

## Rollback

Vercel → project → **Deployments** → pick the last good deployment → **Promote to Production**. Do it for both
projects if the change touched the API and the web app. Database changes are not rolled back; take an
**Admin Settings → Backup** (JSON) before risky releases.

## Limits to know

- Serverless response bodies are capped at 4.5 MB. The JSON backup is built in memory, so very large databases
  should be backed up with `mongodump` against Atlas instead.
- Rate limits are counted per warm function instance, so they are a floor, not an exact global cap.
- Cold starts add a second or two to the first request after idle; the database connection is cached afterwards.
