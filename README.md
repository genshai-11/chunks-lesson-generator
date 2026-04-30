<div align="center">
  <img width="1200" height="475" alt="CHUNKS Lesson Generator" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CHUNKS Lesson Generator

An expert-guided AI workbench for turning weighted language resources into alive, reusable bilingual lesson chunks and inspectable Ohm-based analysis.

- **Production app:** https://chunks-generator.web.app
- **Repository:** https://github.com/genshai-11/chunks-lesson-generator
- **Primary stack:** React + Vite + Firebase Auth + Firestore + configurable AI/TTS providers

---

## What this product is

CHUNKS Lesson Generator is **not** a generic sentence generator.

It is a CHUNKS-native lesson creation tool built around three ideas:

1. **Resources** — reusable words, phrases, sentence frames, and idioms with semantic color + Ohm weight.
2. **Energy design** — use `R`, `I`, and `U` to shape lesson difficulty and output complexity.
3. **Nuance-aware analysis** — inspect transcript/audio input as semantic chunks with total Ohm scoring.

In CHUNKS product language, **Ohm** is a configurable scoring metaphor for:

- expressive resistance
- semantic charge
- lesson difficulty

This gives experts a controllable way to shape generation quality instead of relying on AI randomness alone.

---

## Core features

### 1) Resources

Manage the reusable language ingredients used for lesson generation:

- create/edit/delete resources
- assign color category + base Ohm
- import in bulk
- detect duplicates
- configure default base Ohm values by category

### 2) Mixer

Generate bilingual lesson chunks from selected resources:

- manual chunk generation
- target-Ohm blueprint mode
- recipe mode by color/category
- sentence-length constraints
- regenerate drafts and save good ones

### 3) Chunks DB

Persist generated chunks for later reuse:

- view saved chunks
- edit or delete chunks
- generate/backfill EN + VI audio
- export/manage saved outputs

### 4) Player

Review and replay saved chunks with audio-first practice loops.

### 5) Audio Ohm Test

Analyze text/audio into semantic chunks:

- transcribe audio
- classify transcript substrings
- inspect labels, confidence, reasons
- compute total Ohm

### 6) Settings

Configure:

- AI endpoint and models
- primary/fallback generation behavior
- TTS provider and voice
- transcript model
- Ohm prompt instructions
- M2M API access

---

## CHUNKS concepts used in the app

### Semantic colors

Current canonical categories used by the analysis/generation system:

- **Green** — fillers, discourse markers, transitions
- **Blue** — sentence frames / communication structures
- **Red** — idiomatic or figurative expression
- **Pink** — key terms / lexical concepts

The UI also exposes additional colors in some places (`Yellow`, `Orange`, `Purple`), but the most operationally defined categories today are the four above.

### Energy model

The generator uses a simple lesson-design model:

```text
R = total resource resistance
I = complexity/context multiplier
U = overall lesson energy / difficulty
U = I * R
```

Interpretation:

- **R** anchors the lesson in the selected resources
- **I** raises or lowers challenge
- **U** communicates final output difficulty / expressive load

---

## Architecture at a glance

This repo currently works best when understood as a **hybrid architecture**:

### Local / integrated mode

`npm run dev` starts `server.ts`, which provides:

- an Express server
- Vite middleware for the SPA
- local `/api/*` endpoints for analysis, proxying, transcription, and TTS support

### Production / split mode

Production uses:

- **Firebase Hosting** for the frontend
- **Firebase Auth** for authentication
- **Firestore** for workspace data
- **direct browser calls** to providers where possible
- an optional **shared API origin** via `VITE_API_BASE_URL` for protected/proxy routes

For the full written design, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Project structure

```text
src/
  components/
    ResourcesTab.tsx
    MixerTab.tsx
    ChunksTab.tsx
    PlayerTab.tsx
    AudioOhmTestTab.tsx
    SettingsTab.tsx
  services/
    aiService.ts
    audioService.ts
  firebase.ts
server.ts
firebase-applet-config.json
firebase.json
firestore.rules
```

---

## Data model

Primary Firestore workspace paths used by the app:

- `workspaces/default/resources`
- `workspaces/default/chunks`
- `workspaces/default/settings/ai`
- `workspaces/default/settings/baseOhms`

Main entity types:

- **Resource**
- **Chunk**
- **AISettings**

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the current canonical model.

---

## Local development

### Prerequisites

- Node.js 20+ recommended
- npm
- Firebase project credentials/config already set in `firebase-applet-config.json`
- access to required API keys/secrets

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Use `.env.example` as the source reference.

Common variables:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `M2M_API_KEY`
- `VITE_API_BASE_URL`

Recommended setup:

- put **server-side secrets** in `.env`
- put **Vite client env** (such as `VITE_API_BASE_URL`) in `.env.local` if needed

> Never commit real secrets.

### 3. Start the app

```bash
npm run dev
```

This starts the integrated Express + Vite development server.

### 4. Type-check

```bash
npm run lint
```

### 5. Build production assets

```bash
npm run build
```

---

## Deployment

Production frontend is served from Firebase Hosting:

- https://chunks-generator.web.app

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:

- preview/prod deployment flow
- required Firebase checks
- authorized domains notes
- smoke test checklist
- rollback procedure

---

## M2M / external API usage

The app exposes a semantic chunk analysis endpoint for server-to-server use.

See [API_DOCS_M2M.md](./API_DOCS_M2M.md) for:

- endpoint contract
- auth headers
- request/response format
- webhook mode
- cURL examples

---

## Known current realities

This repo has evolved from earlier AI Studio / integrated-server assumptions into a more hybrid production shape. A few docs and metadata files may still reflect older wording.

The canonical interpretation for maintainers is:

- Firebase Hosting frontend
- Firebase Auth + Firestore data layer
- configurable AI/TTS provider routing
- optional/shared backend origin for protected API behavior

---

## Documentation map

- [ARCHITECTURE.md](./ARCHITECTURE.md) — current system design and runtime topology
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deployment, smoke checks, rollback
- [API_DOCS_M2M.md](./API_DOCS_M2M.md) — semantic chunk analysis API contract
- [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) — operations notes
- [RUNBOOK.md](./RUNBOOK.md) — legacy/operational background

---

## Product positioning

> CHUNKS Lesson Generator is an expert-guided AI workbench for turning weighted language resources into alive, reusable bilingual lesson chunks and inspectable Ohm-based analysis.
