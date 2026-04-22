# Ops Runbook: CHUNKS EdTech Application

## Overview
This runbook provides operational procedures for maintaining, configuring, deployment, and troubleshooting the CHUNKS EdTech platform.

- **GitHub Repository:** [genshai-11/chunks-lesson-generator](https://github.com/genshai-11/chunks-lesson-generator)

## 1. Development Environment
The application is built using React (Vite) and a Node.js (Express) backend.

- **Start Development Server:** 
  - The system automatically handles starts. If it feels stale, use the "Restart Dev Server" tool/command.
  - **Dev Port:** 3000 (Hardcoded by infrastructure).
- **Compilation:** Use `npm run build` for production checks.
- **Linting:** Run `npm run lint` periodically to ensure code quality.

## 2. Configuration & Secrets
Never hardcode secrets. Follow these rules:
- **Environment Variables:** Define all required variables in `.env.example`.
- **Firebase:** Configuration is strictly managed in `firebase-applet-config.json`.
- **Metadata:** Keep `metadata.json` updated with the correct `name` and `description`. Do not put env vars here.

## 3. Firebase Operations
### Switching Firebase Projects/Billing
If changing the Firebase backend (e.g., due to billing limits):
1. Navigate to the Firebase Console, link the new project to Billing.
2. In the AI Studio editor, locate `firebase-applet-config.json`.
3. Update the `projectId`, `databaseId`, and other relevant fields with the new project's config.
4. **Restart Dev Server** immediately after updating the file.
5. If issues persist, re-run `set_up_firebase` in the agent chat to re-provision security rules and credentials.

### Security Rules (firestore.rules)
Any changes to data structure must be audited against the Eight Pillars of Hardened Rules.
- **Validation:** Always use the linting/ESLint tools configured for Firestore rules.
- **Deployment:** Call `deploy_firebase` whenever `firestore.rules` is updated.

## 4. Troubleshooting
### Server unresponsive / Stale state
- Use the **Restart Dev Server** feature.

### "Quota Exceeded" or Firebase errors
- Verify the billing status in the Google Cloud Console for the linked Firebase Project.
- If newly updated, allow 5-10 minutes for quota propagation.

### Dependencies
- If a package is missing:
  1. Use `install_applet_package` for new deps.
  2. Use `install_applet_dependencies` to refresh `node_modules` if build fails.

## 5. Important Constraints
- **Ports:** Port 3000 is the only accessible port.
- **HMR:** Hot Module Replacement is disabled.
- **Artifacts:** `node_modules`, `.next`, `dist` are not persisted.
- **Persistence:** All operational edits must be made via agent tools to persist in the filesystem.
