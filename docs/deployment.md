# Deploying RankIT (Vercel + MongoDB Atlas)

RankIT deploys as **one Vercel project** from the GitHub repository, plus a MongoDB Atlas cluster. The root
[`vercel.json`](../vercel.json) does everything:

| Path | Served by |
|---|---|
| `/api/*` | The Express API as one serverless function ([`api/index.js`](../api/index.js) loads `backend/server.js`) |
| everything else | The static Vite build from `frontend-react/build` (SPA fallback to `index.html`) |

The site and the API share one origin, so the `httpOnly` session cookie stays first-party (`SameSite=Lax`) and no
CORS setup is needed. Every preview deployment gets its own API too, so previews never touch production code paths.

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
5. Optional but recommended: a second database (e.g. `RankIT_Preview`) for preview deployments, so testing a
   branch never changes real event data.

## 2. Vercel project

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** leave it as the repository root. Framework preset: **Other**. Leave build, output and
   install settings on their defaults: `vercel.json` sets them (installs both packages, builds `frontend-react`,
   serves `frontend-react/build`).
3. **Settings → Functions → Region:** the same region as the Atlas cluster. Node.js version comes from the root
   `package.json` (`22.x`).
4. **Settings → Environment Variables:**

   | Name | Environments | Value |
   |---|---|---|
   | `MONGODB_URI` | Production | Atlas SRV string for `RankIT_DB` |
   | `MONGODB_URI` | Preview | Atlas SRV string for the preview database (or the same one if you accept the risk) |
   | `JWT_SECRET` | Production, Preview | 64+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (use different values per environment) |
   | `JWT_EXPIRES_IN` | Production, Preview | `12h` |
   | `NODE_ENV` | Production, Preview | `production` |
   | `CORS_ORIGIN` | optional | Only if another origin must call the API; the app itself is same-origin |

5. Deploy. `https://<project>.vercel.app/api` should answer `{"message":"RankIT API is running"}` and the root
   URL shows the public rankings page. Security headers (CSP, HSTS, `X-Frame-Options`, ...) come from
   `vercel.json`; run `npm run build && npm run preview` in `frontend-react` to test the same headers locally.

### Moving from the old two-project setup

Older versions used two projects (`rankit-api` rooted at `backend`, `rankit` rooted at `frontend-react`). Point
the `rankit` project's **Root Directory** back to the repository root, copy the API project's environment
variables into it, redeploy, then delete the `rankit-api` project.

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

Vercel → project → **Deployments** → pick the last good deployment → **Promote to Production**. Database changes are not rolled back; take an
**Admin Settings → Backup** (JSON) before risky releases.

## Limits to know

- Serverless response bodies are capped at 4.5 MB. The JSON backup is built in memory, so very large databases
  should be backed up with `mongodump` against Atlas instead.
- Rate limits are counted per warm function instance, so they are a floor, not an exact global cap.
- Cold starts add a second or two to the first request after idle; the database connection is cached afterwards.
