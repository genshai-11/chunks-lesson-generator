# CHUNKS Lesson Generator Architecture

This document is the repository-facing system design summary for the current CHUNKS Lesson Generator.

It aligns the codebase with the product intent:

- expert-guided lesson generation
- weighted resource modeling via Ohm
- transcript/audio semantic analysis
- hybrid frontend/backend runtime

---

## 1. Purpose

The system exists to help CHUNKS operators turn reusable language resources into:

- meaningful bilingual lesson chunks
- audio-supported practice assets
- inspectable semantic/Ohm analysis results

This is not a generic text-generation app. It is a CHUNKS-native curriculum workbench.

---

## 2. Main responsibilities

The system currently provides six major capabilities:

1. **Resources** — manage reusable language ingredients
2. **Mixer** — generate chunks from weighted inputs
3. **Chunks DB** — persist and manage generated lesson assets
4. **Player** — replay saved chunks with audio
5. **Audio Ohm Test** — transcribe + analyze semantic chunks
6. **Settings** — configure AI, TTS, transcript, Ohm, and M2M behavior

---

## 3. Runtime model

The current codebase is best understood as a **hybrid architecture**.

### Local / integrated mode

`npm run dev` starts `server.ts`, which runs:

- Express
- Vite middleware
- local `/api/*` routes

This supports a single-process development experience.

### Production / split mode

Production is currently shaped as:

- **Firebase Hosting** for the frontend SPA
- **Firebase Auth** for login
- **Firestore** for app data
- **direct provider calls from browser** where possible
- optional **shared backend origin** via `VITE_API_BASE_URL` for protected or proxy routes

This mixed model explains why some logic exists both in frontend services and in `server.ts`.

---

## 4. Top-level component map

```text
User
-> Firebase Auth
-> React SPA
   -> ResourcesTab
   -> MixerTab
   -> ChunksTab
   -> PlayerTab
   -> AudioOhmTestTab
   -> SettingsTab
-> Firestore workspace data
-> External AI/TTS providers
-> Optional shared API origin
```

---

## 5. Frontend modules

### `src/App.tsx`

- waits for auth state
- gates UI by login status
- routes authenticated users into dashboard

### `src/components/Dashboard.tsx`

- app shell and tab navigation
- exposes all major product modules

### `src/components/ResourcesTab.tsx`

- CRUD for `workspaces/default/resources`
- import and dedupe workflows
- base Ohm settings per category

### `src/components/MixerTab.tsx`

- load resources and settings
- compute `R`, `I`, and `U`
- generate manual and batch chunk drafts
- save drafts to chunk storage

### `src/components/ChunksTab.tsx`

- browse saved chunks
- edit/delete/export chunk content
- generate or backfill audio URLs

### `src/components/PlayerTab.tsx`

- playback UI for saved chunk practice
- audio-first review of saved outputs

### `src/components/AudioOhmTestTab.tsx`

- audio recording / text input
- transcription
- semantic chunk analysis
- total Ohm display and explanation

### `src/components/SettingsTab.tsx`

- AI provider config
- fallback models
- TTS config
- transcript model config
- Ohm prompt/base-value config
- M2M API key config

---

## 6. Service layer

### `src/services/aiService.ts`

Main responsibilities:

- build prompts for chunk generation
- build prompts for transcript analysis
- normalize AI endpoints
- fetch model lists
- route requests through custom provider or Gemini path
- handle fallback behavior

### `src/services/audioService.ts`

Main responsibilities:

- generate audio via configured TTS provider
- return playable audio URLs for chunk playback

### `server.ts`

Main responsibilities:

- integrated dev server
- M2M validation middleware
- `/api/analyze-ohm`
- `/api/transcribe`
- `/api/ai/models`
- `/api/ai/chat`
- `/api/tts`
- `/api/ping`

---

## 7. Core product concepts

### Ohm

In this app, **Ohm** is a configurable product metaphor for:

- expressive resistance
- semantic charge
- lesson difficulty

It appears in two main forms:

1. **Resource Ohm** — base weight attached to a reusable language resource
2. **Transcript Ohm** — computed total from classified semantic chunks

### Semantic categories

Current canonical categories in the code/docs are:

- **Green** — fillers, transitions, discourse markers
- **Blue** — sentence frames and communication structures
- **Red** — idiomatic / figurative expression
- **Pink** — key terms / lexical concepts

### Energy model

The generation system uses:

```text
R = total resource resistance
I = complexity / context multiplier
U = lesson energy / difficulty
U = I * R
```

This lets experts tune difficulty while keeping generation grounded in curated resources.

---

## 8. Data model

Primary Firestore paths observed in the app:

- `workspaces/default/resources`
- `workspaces/default/chunks`
- `workspaces/default/settings/ai`
- `workspaces/default/settings/baseOhms`

### Resource

Represents a weighted reusable language ingredient.

Fields used in code:

- `id`
- `name`
- `color`
- `ohm`
- `userId`
- `createdAt`

### Chunk

Represents a generated bilingual lesson artifact.

Fields used in code:

- `resourcesUsed`
- `engSentence`
- `vieSentence`
- `rTotal`
- `iValue`
- `uTotal`
- `category`
- `difficultyLabel`
- `audioUrl`
- `vieAudioUrl`
- `userId`
- `createdAt`

### AI settings

Used to control provider and generation behavior:

- endpoint
- apiKey
- primaryModel
- fallbackModel
- transcript model
- TTS config
- Ohm prompt instructions
- formula type
- complexity multipliers
- sentence constraints
- M2M key

---

## 9. Main flows

### Resource creation

```text
User creates resource
-> assign color + Ohm
-> write to Firestore resources collection
-> realtime snapshot refreshes UI
```

### Manual chunk generation

```text
User selects resources + theme + sentence length
-> Mixer computes R/I/U
-> aiService builds prompt
-> provider returns bilingual JSON
-> draft is shown
-> user saves to chunks collection
```

### Blueprint / batch generation

```text
User chooses target Ohm or recipe mode
-> system assembles resource combinations
-> AI returns draft chunk set
-> user reviews/regenerates
-> selected drafts are saved
```

### Audio analysis

```text
User records/uploads/provides transcript
-> transcribe if needed
-> analyze transcript into semantic chunks
-> compute total Ohm
-> render labels, confidence, formula, and totals
```

### M2M analysis

```text
External system -> /api/analyze-ohm
-> validate X-API-Key
-> run analysis
-> return JSON or webhook callback
```

---

## 10. Security boundaries

Current security boundaries are lightweight and practical:

- Firebase Auth protects the main UI
- M2M analysis routes require `X-API-Key`
- secrets are expected in environment variables or settings, not hardcoded in docs

### Important note

Do **not** place real API keys in documentation, examples, or screenshots.

---

## 11. Architectural risks

1. **Documentation drift**
   - older AI Studio / Cloud Run wording still exists in some files

2. **Mixed runtime assumptions**
   - local integrated server vs static frontend deployment can be confusing without explicit docs

3. **Domain drift**
   - some UI colors and formulas are more advanced than their formal docs today

4. **Workspace coupling**
   - `workspaces/default/*` is simple, but future multi-workspace support may need more explicit ownership rules

5. **Quality evaluation gap**
   - generation is controllable, but semantic quality remains prompt-driven rather than fully deterministic

---

## 12. Canonical maintainer decisions

For maintainers, treat the system as:

- a **Firebase-hosted frontend**
- a **Firestore-backed workspace app**
- a **provider-configurable AI/TTS workbench**
- an app with **optional server-backed protected routes** for analysis/proxy behavior

Do not document it as a plain AI Studio template app anymore.

---

## 13. Related docs

- [README.md](./README.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [API_DOCS_M2M.md](./API_DOCS_M2M.md)
