# CHUNKS Lesson Generator Deployment Guide

This document describes the practical deployment model for the current CHUNKS Lesson Generator.

The repository should be treated as a **hybrid deployment**:

- **Firebase Hosting** serves the frontend
- **Firebase Auth + Firestore** provide auth and persistence
- an optional/shared backend origin can power protected API routes and proxy behavior

---

## 1. Environments

### Production frontend

- https://chunks-generator.web.app

### Example shared API origin

Configured through:

- `VITE_API_BASE_URL`

Example value used in current docs/config:

- `https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app`

> Use your actual backend/shared API origin for the active environment.

---

## 2. Deployment responsibilities

### Firebase Hosting

Responsible for:

- serving the built SPA from `dist/`
- handling client-side routing via SPA rewrite

### Firebase Auth

Responsible for:

- Google Sign-In
- authorized domain enforcement

### Firestore

Responsible for:

- resources
- chunks
- settings
- base Ohm values

### Shared backend / API origin

If enabled, responsible for:

- `/api/analyze-ohm`
- `/api/transcribe`
- `/api/ai/models`
- `/api/ai/chat`
- `/api/tts`
- `/api/ping`

---

## 3. Required configuration checks

Before deploying, verify:

### Firebase Hosting

- `.firebaserc` maps target `chunks-generator` correctly
- `firebase.json` points hosting `public` to `dist`
- SPA rewrite to `/index.html` exists

### Firebase Auth

Authorized domains should include at least:

- `chunks-generator.web.app`
- `chunks-generator.firebaseapp.com` (recommended fallback)

### Firestore / Firebase config

- `firebase-applet-config.json` points to the intended Firebase project
- security rules are compatible with the current data model

### Environment / secrets

Do **not** commit secrets.

Validate the required runtime values for the target environment:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY` (if used)
- `M2M_API_KEY` (if used)
- `VITE_API_BASE_URL` (if using shared/protected backend routes)

---

## 4. Local pre-deploy checklist

Run locally before any release:

```bash
npm install
npm run lint
npm run build
```

Expected result:

- type-check passes
- Vite build completes
- `dist/` is generated

---

## 5. Suggested deployment flow

### Step 1 — create a clean checkpoint

Commit and tag before publishing.

Example:

```bash
git add .
git commit -m "docs: sync repo documentation"
git tag -a deploy-chunks-generator-YYYY-MM-DD-HHMM -m "Pre-deploy tag"
git push origin main --tags
```

### Step 2 — deploy preview first

Example preview flow:

```bash
firebase hosting:channel:deploy preprod --project gen-lang-client-0815518176 --only chunks-generator
```

Expected result:

- preview URL returned
- built app accessible

### Step 3 — preview validation

Validate at minimum:

- app shell loads
- login screen appears correctly
- Google Sign-In opens without authorized-domain errors
- resources list loads
- settings page loads
- no fatal console errors on first render

If using shared API features, also validate:

- model list fetch works
- transcript analysis works
- audio generation path works (or fails clearly)

### Step 4 — deploy production

```bash
firebase deploy --project gen-lang-client-0815518176 --only hosting:chunks-generator
```

---

## 6. Smoke test checklist

After production deploy, verify:

### Frontend

- production URL loads
- no blank screen
- navigation across all tabs works

### Auth

- Google Sign-In works from production domain
- logout/login cycle works

### Data

- resources can be read
- a resource can be created
- a chunk can be saved
- saved chunks appear in Chunks DB / Player

### AI

- manual chunk generation succeeds
- regeneration works
- failures show actionable messages

### Analysis

- Audio Ohm Test can analyze text transcript
- total Ohm and chunk list render correctly

### Audio

- audio preview or playback works where configured
- missing audio falls back clearly or surfaces a helpful error

---

## 7. Rollback

If deploy introduces a production issue:

### Frontend rollback

1. Checkout the previous stable tag/commit
2. Rebuild
3. Redeploy Firebase Hosting

Example:

```bash
git checkout <stable_tag_or_commit>
npm install
npm run build
firebase deploy --project gen-lang-client-0815518176 --only hosting:chunks-generator
```

### Shared backend rollback

If the issue is in the external/shared API origin, roll back that service independently according to its own deployment process.

---

## 8. Troubleshooting

### Google Sign-In fails on production

Likely cause:

- authorized domain missing in Firebase Auth

Fix:

- add `chunks-generator.web.app` to authorized domains

### App loads but provider-dependent features fail

Likely causes:

- missing `VITE_API_BASE_URL`
- wrong provider endpoint
- invalid API keys

Check:

- Settings tab values
- browser network requests
- backend/shared API health endpoint if applicable

### M2M / analysis calls fail with 401

Likely cause:

- missing or invalid `X-API-Key`

See [API_DOCS_M2M.md](./API_DOCS_M2M.md).

### Analysis endpoint returns redirect or HTML instead of JSON

Likely cause:

- wrong origin or gateway challenge issue

Check:

- you are using the correct shared API origin
- required request headers are present
- `/api/ping` works on the selected API origin

---

## 9. Canonical deployment summary

Treat production as:

- **Firebase Hosting frontend**
- **Firebase Auth + Firestore core app services**
- **optional/shared backend origin** for protected or proxy API workflows

This is the canonical deployment story maintainers should keep in sync with the codebase.
