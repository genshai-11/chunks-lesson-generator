# Supabase Migration Plan

## Context

The current Firebase project cannot move to Blaze because it is linked to AI Studio. The practical short-term path is to create a new Firebase/GCP project, migrate the existing Firestore data, and repoint this cloned codebase. The longer-term path is to replace Firebase Auth and Firestore with Supabase Auth and Postgres.

Current Firebase source:

- Project ID: `gen-lang-client-0815518176`
- Firestore database ID: `ai-studio-c7c3c8c1-0231-4a17-a4d2-ac3b68c5d46a`
- Region: `asia-east1`
- Main app data prefix: `workspaces/default`

Current Firebase surfaces in this repo:

- `src/firebase.ts`: Firebase app, Auth, Firestore init, quota error handling.
- `src/services/cacheService.ts`: Firestore cache helpers.
- `src/components/*`: direct Firestore reads/writes in Resources, Chunks, CVR Measure, Dashboard, Mixer, Player, Settings, Chatbot.
- `firebase-applet-config.json`: hard-coded Firebase client config.

## Phase 0: Clone And Stabilize

Completed locally:

- Cloned `https://github.com/genshai-11/chunks-lesson-generator` into `C:\Users\gensh\OneDrive\May tinh\LUCY\PROJECT-WORKPLACE\CHUNKS\CVR-project`.
- Confirmed repo remote is `origin https://github.com/genshai-11/chunks-lesson-generator`.

Immediate stabilization before any full Supabase rewrite:

- Create a new Firebase project that can use Blaze.
- Create Firestore in the nearest available region to users. If matching the old location is required, use `asia-east1` if available for the new Firestore database.
- Enable Google Auth provider.
- Add app domain(s) to Firebase Auth authorized domains.
- Create a new Web App and replace `firebase-applet-config.json` values.
- Migrate data from the old Firestore database to the new Firestore database.
- Keep the current app behavior stable while Supabase migration is developed behind a data-access abstraction.

## Phase 1: Firebase-To-Firebase Data Migration

Collections/documents to copy from `workspaces/default`:

- `resources`
- `chunks`
- `cvr_history`
- `settings/ai`
- `settings/baseOhms`

Recommended migration method:

- Use a service account for the old Firebase/GCP project with Firestore read access.
- Use a service account for the new Firebase/GCP project with Firestore write access.
- Export each collection to JSON first.
- Import JSON into the new project.
- Verify document counts and a sample of records before pointing production config to the new project.

Important Auth caveat:

- Firestore docs currently store `userId` values from Firebase Auth.
- A new Firebase project can produce different user UIDs after Google login unless users are imported or mapped.
- If keeping shared workspace data under `workspaces/default`, app behavior may still work, but rules and ownership checks must be reviewed.

## Phase 2: Supabase Target Model

Use Postgres tables instead of Firestore nested collections. Keep `workspaces/default` as explicit relational data.

Proposed tables:

```sql
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  firebase_id text unique,
  name text not null,
  hint text,
  color text not null,
  ohm numeric not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  firebase_id text unique,
  resources_used jsonb not null default '[]'::jsonb,
  eng_sentence text not null,
  vie_sentence text not null,
  r_total numeric not null,
  i_value numeric not null,
  tl numeric,
  lc numeric,
  u_total numeric not null,
  category text not null,
  difficulty_label text not null,
  evaluation text,
  audio_url text,
  vie_audio_url text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.cvr_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  firebase_id text unique,
  payload jsonb not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.workspace_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);
```

Indexes:

```sql
create index resources_workspace_created_at_idx on public.resources(workspace_id, created_at desc);
create index resources_workspace_name_idx on public.resources(workspace_id, lower(name));
create index chunks_workspace_created_at_idx on public.chunks(workspace_id, created_at desc);
create index chunks_workspace_category_idx on public.chunks(workspace_id, category);
create index cvr_history_workspace_created_at_idx on public.cvr_history(workspace_id, created_at desc);
```

## Phase 3: Supabase Security Model

Supabase changelog note for 2026 projects:

- New tables may not be exposed to the Data API automatically.
- Explicit grants may be required for `anon` and `authenticated` roles depending on project settings.
- RLS must be enabled on all exposed tables before granting access.

Recommended first version:

- Use Supabase Auth with Google provider.
- Create `workspace_members` if the app will have multiple workspaces or non-public data.
- Enable RLS on all public tables.
- Start with authenticated-only policies scoped to workspace membership.
- Do not store provider API keys in browser-readable rows long-term. Move AI/TTS keys to server-side environment variables or encrypted/private settings.

Example membership table:

```sql
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
```

## Phase 4: Code Migration Strategy

Do not replace Firebase imports component-by-component as the first step. Create a repository/service layer first.

Recommended files:

- `src/services/dataClient.ts`: exports typed operations used by UI.
- `src/services/firebaseDataClient.ts`: current Firebase implementation.
- `src/services/supabaseDataClient.ts`: new Supabase implementation.
- `src/services/authClient.ts`: abstracts `currentUser`, sign-in, sign-out.
- `src/supabase.ts`: Supabase client init from env vars.

Target operations:

- `auth.signInWithGoogle()`
- `auth.signOut()`
- `auth.getCurrentUser()`
- `resources.list({ workspaceSlug, page, pageSize, filters })`
- `resources.create(data)`
- `resources.update(id, patch)`
- `resources.delete(id)`
- `chunks.list({ workspaceSlug, page, pageSize, filters })`
- `chunks.create(data)`
- `chunks.update(id, patch)`
- `chunks.delete(id)`
- `settings.get(key)`
- `settings.set(key, value)`
- `cvrHistory.list()`
- `cvrHistory.create(payload)`

Then migrate UI tabs one by one:

1. `Auth.tsx` and `src/firebase.ts` replacement.
2. `SettingsTab.tsx` because it controls API keys and generation settings.
3. `ResourcesTab.tsx` because it is the core TC resource library.
4. `ChunksTab.tsx`, `PlayerTab.tsx`, `MixerTab.tsx`.
5. `CVRMeasureTab.tsx` and `Chatbot.tsx`.
6. Remove Firebase package and config after parity is verified.

## Phase 5: Data Migration To Supabase

Migration pipeline:

1. Export Firestore collections to JSON.
2. Create Supabase schema and RLS policies.
3. Insert workspace row for `default`.
4. Import `resources`, preserving Firestore document IDs in `firebase_id`.
5. Import `chunks`, preserving `resourcesUsed` as JSONB for v1 compatibility.
6. Import `cvr_history` as JSONB payload first, then normalize later if needed.
7. Import `settings/ai` and `settings/baseOhms` into `workspace_settings`.
8. Run counts and sample comparisons.
9. Switch app env from Firebase to Supabase.
10. Keep Firestore read-only backup until Supabase production has been verified.

Verification checks:

- Resource count matches Firestore.
- Chunk count matches Firestore.
- Latest 20 chunks sort identically by `createdAt`/`created_at`.
- Existing base Ohm settings load correctly.
- AI settings load and save correctly.
- CVR Measure Engine can save and reload history.
- Google login works in a new browser session.

## Phase 6: Rollout Plan

Recommended rollout order:

1. Create new Firebase Blaze project and migrate data now to unblock quota.
2. Deploy cloned app against new Firebase config.
3. Add data-client abstraction while still using Firebase.
4. Add Supabase schema and import script.
5. Build Supabase implementation behind an env flag.
6. Run dual-read verification in development.
7. Cut over to Supabase in production.
8. Archive Firebase as backup.

## Open Decisions

- Whether Supabase should fully replace Firebase Auth or use Supabase third-party/Firebase auth bridge during transition.
- Whether `resourcesUsed` should remain JSONB or become a normalized `chunk_resources` join table.
- Whether API keys in settings should remain user-editable client data or move to server-only secrets.
- Whether the app remains a single shared `default` workspace or needs multi-workspace ownership.
