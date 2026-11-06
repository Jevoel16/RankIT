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

## 3. Google and GitHub sign-in

Accounts are created **only** by signing in with Google or GitHub, so set up at least one provider. The first
sign-in creates the account (username = GitHub login or the part of the Google email before `@`, with a number added
if taken) and asks for a password, so the person can also sign in with username + password. The account then waits
until an admin assigns a role (tabulator, grievance or admin). More providers can be linked under
**Connected accounts** (link icon in the header, or the menu on phones). A provider's button appears only when both
of its variables are set.

The redirect URIs are `<APP_URL>/api/auth/google/callback` and `<APP_URL>/api/auth/github/callback`. `APP_URL`
defaults to the production domain on Vercel, so OAuth works on production; preview URLs change per deployment, so
previews only allow password sign-in for existing accounts.

Order of setup (the providers need the URL before you can get the keys):
1. Deploy once (section 2) and note the production URL, e.g. `https://<project>.vercel.app`.
2. Create the Google client and/or GitHub app below with that URL.
3. Add the provider variables to Vercel (Production).
4. **Redeploy** (Deployments → latest → Redeploy): new variables only reach new deployments.
5. If you later add a custom domain, set `APP_URL` to it, update the callback URLs at each provider, and redeploy.

**Google** (Google Cloud Console → APIs & Services):
1. **OAuth consent screen**: app name `RankIT`, user type External, upload
   [`docs/brand/oauth-google-120.png`](brand/oauth-google-120.png) as the app logo, scopes `openid`, `email`,
   `profile`. Publish the app (or add test users while it is in testing).
2. **Credentials → Create credentials → OAuth client ID**: Web application. Authorized redirect URI:
   `https://<your-domain>/api/auth/google/callback` (add `http://localhost:3000/api/auth/google/callback` for local
   testing).
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**GitHub** (GitHub → Settings → Developer settings → OAuth Apps → New OAuth App):
1. Name `RankIT`, homepage `https://<your-domain>`, callback URL `https://<your-domain>/api/auth/github/callback`.
   GitHub allows one callback URL per app, so create a second app for local testing.
2. On the app page, upload [`docs/brand/oauth-github-512.png`](brand/oauth-github-512.png) as the logo and set the
   badge background to `#0b1017`.
3. Generate a client secret and put the values in `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

| Name | Environments | Value |
|---|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Production | From the Google OAuth client |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Production | From the GitHub OAuth App |
| `APP_URL` | optional | Only if the public URL isn't the Vercel production domain (e.g. a custom domain) |

The other logo exports (GitHub social preview, large icon) and where they go are listed in
[`docs/brand/README.md`](brand/README.md).

## 4. Superadmin and the first admin

Never run `seed:users` / `seed:events` against production: they use a shared demo password and reset data
(the scripts refuse non-local databases unless forced). Create the superadmin instead; it is the only account
not created through Google/GitHub, and its only job is recovering admin access:

```bash
cd backend
MONGODB_URI="<atlas SRV string>" npm run create:superadmin
```

It prompts for a username and a password (12+ characters), hashes it, and prints the username. Then:

1. The future admin signs in with Google or GitHub and sets a password.
2. The superadmin signs in with username + password and clicks **Make admin** on that account in **Admin Recovery**.
3. From then on admins assign every other role. The superadmin can only promote someone to admin or reset an
   admin's password (for example when an admin is locked out).

### Upgrading from 2.x

Version 3.0 drops the `name@role.rankit` usernames and the approval fields. After deploying, run once against the
production database (preview first with `--dry-run`):

```bash
cd backend
MONGODB_URI="<atlas SRV string>" npm run migrate:accounts -- --dry-run
MONGODB_URI="<atlas SRV string>" npm run migrate:accounts
```

It strips the `@role.rankit` suffix (adding a number on clashes), turns pending accounts into "waiting for a role",
disables rejected ones, and signs everyone out. Tell staff their new username (the printed list), and re-run
`create:superadmin` if the superadmin should get a new name.

## 5. Smoke test before announcing

On a preview URL first, then production:

- Public page loads and shows rankings (or "Stay tuned").
- Staff sign in works for each role; DevTools → Application → Cookies shows `rankit_session` as `HttpOnly`,
  `Secure`, `SameSite=Lax`, and Local Storage has no token.
- Record a score as a tabulator, file a deduction as grievance, and download a Master Report PDF as admin.
- Six wrong passwords in a row return "Too many login attempts".
- If OAuth is set up: a first "Continue with Google/GitHub" asks for a password, then shows "Waiting for an admin
  to assign your role"; once an admin assigns a role, the same button lands on the role's console.

## Rollback

Vercel → project → **Deployments** → pick the last good deployment → **Promote to Production**. Database changes are not rolled back; take an
**Admin Settings → Backup** (JSON) before risky releases.

## Limits to know

- Serverless response bodies are capped at 4.5 MB. The JSON backup is built in memory, so very large databases
  should be backed up with `mongodump` against Atlas instead.
- Rate limits are counted per warm function instance, so they are a floor, not an exact global cap.
- Cold starts add a second or two to the first request after idle; the database connection is cached afterwards.
