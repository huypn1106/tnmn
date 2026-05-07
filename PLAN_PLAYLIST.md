# Listen Together — Multi-Playlist per Server

> **Implement this before Phase 6 (LLM Playlist) in PLAN.md.**
> Assumes the core app (PLAN.md Phases 1–5) is already implemented.
> The current data model has one flat `queue` subcollection per server.
> This plan migrates that into named, switchable **Playlists** — each server can have many.
> LLM playlist generation and recommendations are added in Phase 6 of PLAN.md,
> which builds on top of the data structures defined here.

---

## Table of Contents

1. [What Changes](#1-what-changes)
2. [Data Model Migration](#2-data-model-migration)
3. [Architecture Impact](#3-architecture-impact)
4. [Implementation Steps](#4-implementation-steps)
5. [UI Specification](#5-ui-specification)
6. [Migration Strategy](#6-migration-strategy)

---

## 1. What Changes

### Before (current)

Each server has a single implicit queue:

```
servers/{serverId}/queue/{itemId}   ← one flat list
```

Playback always plays from this one queue. There is no concept of switching playlists.

### After (this plan)

Each server has multiple named playlists. One playlist is marked as **active** — the DJ plays from it. Members can browse, edit, or queue from any playlist without affecting playback.

```
servers/{serverId}/playlists/{playlistId}          ← playlist metadata
servers/{serverId}/playlists/{playlistId}/tracks/{trackId}  ← tracks inside
```

The `servers/{serverId}` document gains an `activePlaylistId` field. The RTDB playback node gains a `playlistId` field so all clients know which playlist the DJ is drawing from.

### What stays the same

- Track data shape (`source`, `sourceId`, `title`, `thumbnail`, `order`, `addedBy`) — unchanged
- RTDB sync mechanism — unchanged, just gains `playlistId`
- YouTube IFrame + SoundCloud players — unchanged
- DJ role + handoff — unchanged
- Auto-advance — reads from the active playlist's tracks instead of `queue/`

---

## 2. Data Model Migration

### New collection: `playlists`

#### `servers/{serverId}/playlists/{playlistId}`

```ts
{
  name: string;               // "Lofi Sundays", "Road Trip", "Deep Focus"
  description: string | null; // optional, short
  coverURL: string | null;    // optional image (Firebase Storage)
  createdBy: string;          // uid
  createdAt: Timestamp;
  trackCount: number;         // denormalized — updated on track add/remove
  totalDuration: number;      // seconds, denormalized
  source: 'manual' | 'youtube_import' | 'llm'; // 'llm' used by Phase 6
  llmPrompt: string | null;   // populated by Phase 6 LLM generation; null for now
  order: number;              // for sidebar ordering (fractional indexing)
}
```

#### `servers/{serverId}/playlists/{playlistId}/tracks/{trackId}`

```ts
// Identical shape to the existing queue items
{
  source: 'youtube' | 'soundcloud' | 'url';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;           // seconds
  addedBy: string;            // uid
  order: number;              // fractional indexing
  addedAt: Timestamp;
}
```

### Changes to existing documents

#### `servers/{serverId}` — two new fields

```ts
{
  // ... existing fields ...
  activePlaylistId: string | null;   // which playlist the DJ is playing from
  defaultPlaylistId: string | null;  // created automatically on server creation
}
```

#### RTDB `playback/{serverId}` — one new field

```ts
{
  // ... existing fields ...
  playlistId: string;   // which playlist the current track belongs to
}
```

### What to do with the existing `queue` subcollection

See [Section 7 — Migration Strategy](#7-migration-strategy). The existing `queue` data is migrated into a playlist named **"Queue"** on first load. The old subcollection is then deleted.

---

## 3. Architecture Impact

```
servers/{serverId}
├── activePlaylistId ──────────────────────────────────────────────┐
│                                                                   │
├── playlists/                                                      │
│   ├── {playlistId-A}  "Lofi Sundays"  ◄── activePlaylistId ──────┘
│   │   └── tracks/
│   │       ├── {trackId-1}
│   │       └── {trackId-2}
│   │
│   ├── {playlistId-B}  "Road Trip"
│   │   └── tracks/
│   │       └── {trackId-3}
│   │
│   └── {playlistId-C}  "Deep Focus"  ◄── LLM generated
│       └── tracks/
│           └── {trackId-4}
│
RTDB: playback/{serverId}
├── playlistId  ◄── matches activePlaylistId when DJ starts playing
├── trackId
├── position
└── playing
```

### Hook changes

| Hook | Before | After |
|---|---|---|
| `useQueue` | Reads `servers/{sid}/queue` | Replaced by `useTracks(serverId, playlistId)` |
| `usePlaybackSync` | References queue items | References `playlists/{pid}/tracks` items |

> `generatePlaylist` and `useRecommendations` are updated in Phase 6 of PLAN.md to target the new playlist paths.

---

## 4. Implementation Steps

---

### Step P1 — Playlist data layer

#### Step P1.1 — Create `usePlaylists` hook

- Create `src/features/playlists/usePlaylists.ts`
- Firestore query: `collection(db, 'servers', serverId, 'playlists')`, `orderBy('order', 'asc')`
- `onSnapshot` listener — returns live array of playlist metadata
- Separate hook `useTracks(serverId, playlistId)` — mirrors the existing `useQueue` but points to `playlists/{playlistId}/tracks`

```ts
// src/features/playlists/usePlaylists.ts
export function usePlaylists(serverId: string) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    if (!serverId) return;
    const ref = collection(db, 'servers', serverId, 'playlists');
    const q = query(ref, orderBy('order', 'asc'));
    return onSnapshot(q, snap =>
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)))
    );
  }, [serverId]);

  return playlists;
}

export function useTracks(serverId: string, playlistId: string | null) {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!serverId || !playlistId) return;
    const ref = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
    const q = query(ref, orderBy('order', 'asc'));
    return onSnapshot(q, snap =>
      setTracks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Track)))
    );
  }, [serverId, playlistId]);

  return tracks;
}
```

**Exit criterion:** `usePlaylists('server-id')` returns a live array that updates when a playlist document is added or removed in Firestore (verified by manually adding a doc in the Firebase console — array updates within 1 second without a page reload). `useTracks` with a null `playlistId` returns `[]` without error.

---

#### Step P1.2 — Playlist CRUD functions

Create `src/features/playlists/playlistActions.ts`:

```ts
// Create a new empty playlist
export async function createPlaylist(
  serverId: string,
  name: string,
  createdBy: string,
  source: 'manual' | 'llm' | 'youtube_import' = 'manual',
  llmPrompt: string | null = null
): Promise<string> {
  const ref = collection(db, 'servers', serverId, 'playlists');
  const lastOrder = await getLastPlaylistOrder(serverId);
  const doc = await addDoc(ref, {
    name,
    description: null,
    coverURL: null,
    createdBy,
    createdAt: serverTimestamp(),
    trackCount: 0,
    totalDuration: 0,
    source,
    llmPrompt,
    order: lastOrder + 1000,
  });
  return doc.id;
}

// Rename or update metadata
export async function updatePlaylist(
  serverId: string,
  playlistId: string,
  patch: Partial<Pick<Playlist, 'name' | 'description' | 'coverURL'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'servers', serverId, 'playlists', playlistId),
    patch
  );
}

// Delete playlist and all its tracks (batch delete)
export async function deletePlaylist(
  serverId: string,
  playlistId: string
): Promise<void> {
  // Delete all tracks first
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const tracksSnap = await getDocs(tracksRef);
  const batch = writeBatch(db);
  tracksSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'servers', serverId, 'playlists', playlistId));
  await batch.commit();
}

// Set a playlist as active (DJ action only)
export async function setActivePlaylist(
  serverId: string,
  playlistId: string
): Promise<void> {
  await updateDoc(doc(db, 'servers', serverId), { activePlaylistId: playlistId });
}
```

**Exit criterion:** `createPlaylist('sid', 'Road Trip', uid)` creates a Firestore document under `servers/sid/playlists/` with all required fields (verified in console). `deletePlaylist` removes the playlist document and all its track subdocuments — Firestore console shows both are gone. `updatePlaylist` with `{ name: 'New Name' }` updates only the `name` field, leaving other fields intact.

---

#### Step P1.3 — Track add / remove / reorder (within a playlist)

Create `src/features/playlists/trackActions.ts` — mirrors existing queue actions but targets the new path:

```ts
export async function addTrackToPlaylist(
  serverId: string,
  playlistId: string,
  track: Omit<Track, 'id' | 'order' | 'addedAt'>,
  addedBy: string
): Promise<void> {
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const lastOrder = await getLastTrackOrder(serverId, playlistId);

  const batch = writeBatch(db);

  // Add the track
  const trackRef = doc(tracksRef);
  batch.set(trackRef, {
    ...track,
    addedBy,
    order: lastOrder + 1000,
    addedAt: serverTimestamp(),
  });

  // Increment denormalized trackCount
  const playlistRef = doc(db, 'servers', serverId, 'playlists', playlistId);
  batch.update(playlistRef, {
    trackCount: increment(1),
    totalDuration: increment(track.duration ?? 0),
  });

  await batch.commit();
}

export async function removeTrackFromPlaylist(
  serverId: string,
  playlistId: string,
  trackId: string,
  duration: number
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'servers', serverId, 'playlists', playlistId, 'tracks', trackId));
  batch.update(doc(db, 'servers', serverId, 'playlists', playlistId), {
    trackCount: increment(-1),
    totalDuration: increment(-duration),
  });
  await batch.commit();
}
```

**Exit criterion:** Adding a track increments `trackCount` by 1 on the parent playlist document (verified in Firestore console — both the track subdoc and the updated count appear together). Removing a track decrements by 1. The `totalDuration` field stays in sync. Adding and removing in rapid succession (3 adds, 2 removes) leaves `trackCount` at 1 — no race condition from batched writes.

---

#### Step P1.4 — Update `usePlaybackSync` to reference playlists

- `usePlaybackSync` currently reads the next track from `servers/{sid}/queue/`
- Change auto-advance to: read next track from `servers/{sid}/playlists/{playlistId}/tracks/` where `playlistId` comes from `playbackState.playlistId`
- When DJ sets active playlist and starts playing: write `playlistId` to RTDB alongside `trackId`
- Listener clients: on RTDB snapshot, compare `playlistId` — if changed, update the local "current playlist" reference

```ts
// Inside usePlaybackSync — DJ write on track change
const setTrack = (track: Track, playlistId: string) => {
  rtdb.ref(`playback/${serverId}`).update({
    trackId: track.id,
    playlistId,               // ← new field
    source: track.source,
    sourceId: track.sourceId,
    position: 0,
    playing: true,
    updatedAt: Date.now(),
    djId: currentUser.uid,
  });
};

// Auto-advance — find next track in same playlist
const handleTrackEnd = async () => {
  const { playlistId, trackId } = currentPlaybackState;
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const q = query(tracksRef, where('order', '>', currentTrack.order), orderBy('order'), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    setTrack({ id: snap.docs[0].id, ...snap.docs[0].data() } as Track, playlistId);
  } else {
    // End of playlist — stop
    rtdb.ref(`playback/${serverId}`).update({ playing: false });
  }
};
```

**Exit criterion:** DJ plays from Playlist A. Auto-advance moves to the next track in Playlist A. When Playlist A ends, playback stops (does not bleed into Playlist B). Listener clients in a second tab correctly follow the DJ's playlist — verified by watching the RTDB console while the DJ changes tracks.

---

### Step P2 — Playlist sidebar UI

#### Step P2.1 — Playlist list panel

Replace the current single-queue panel header with a **playlist selector sidebar** within the server view:

- Create `src/features/playlists/PlaylistSidebar.tsx`
- Positioned between the server nav sidebar and the main track list panel
- Shows all playlists for the current server (from `usePlaylists`)
- Each item:
  - Cover art thumbnail (40×40, fallback = first letter of playlist name)
  - Playlist name in `--font-serif`
  - Track count + total duration in `--font-mono --text-3`
  - Active playlist (playing) marked with `--accent` left border + waveform bars icon
- "＋ New playlist" button at the bottom — opens `CreatePlaylistModal`
- Clicking a playlist sets it as the **viewed** playlist (local state only — does not affect playback unless user is DJ and explicitly switches)

Layout at desktop: `[Server nav 60px] [Playlist sidebar 200px] [Track list 1fr] [Chat rail 280px]`

**Exit criterion:** Creating three playlists shows three items in the sidebar. The active playlist (currently playing) has the accent left border and waveform icon. Clicking a non-active playlist changes the track list panel to show that playlist's tracks without interrupting playback. Switching back to the active playlist shows the correct tracks. The sidebar scrolls independently if there are more than 8 playlists.

---

#### Step P2.2 — Create playlist modal

- Create `src/features/playlists/CreatePlaylistModal.tsx`:
  - Text input: playlist name (required, max 50 chars)
  - Text input: description (optional, max 120 chars)
  - Optional cover image upload → Firebase Storage `covers/playlists/{playlistId}`
  - Three creation modes, shown as pill tabs:
    - **Empty** — blank playlist, add tracks manually
    - **From YouTube playlist** — URL input, imports via Data API v3 (same logic as Step 2.6 in PLAN.md, now targeting the new playlist path)
    - **Generate with AI** — prompt input, calls LLM pipeline (same as Phase 6 in PLAN.md)
  - On submit with mode "Empty": calls `createPlaylist` then navigates to the new playlist
  - On submit with mode "From YouTube playlist": `createPlaylist` → `importPlaylistToPlaylist`
  - On submit with mode "Generate with AI": `createPlaylist` → `generateAndFillPlaylist`

**Exit criterion:** Creating an empty playlist adds a Firestore document and the new item appears in the sidebar within 1 second. Creating from a YouTube playlist URL imports all tracks into the new playlist's `tracks` subcollection (verified in Firestore console). Creating with AI generates tracks and adds them. All three modes land on the new playlist's track view after creation. Submitting with an empty name field shows a validation error and does not submit.

---

#### Step P2.3 — Track list panel (playlist-aware)

Replace `QueuePanel.tsx` with `TrackListPanel.tsx`:

- Displays tracks from the **viewed** playlist (not necessarily the playing one)
- Header bar:
  - Playlist name in `--font-serif` large
  - Description in `--font-mono --text-3` small
  - Track count + total duration
  - "Play" button (DJ only) — sets this playlist as active and starts from track 1
  - "＋ Add track" button — opens `AddTrackModal` targeting this playlist
  - "⋯" overflow menu: Rename, Edit description, Delete playlist, Export (copy all titles to clipboard)
- Track rows (same drag-to-reorder as before, using `@dnd-kit`)
- Each row additionally shows: position number, duration, `addedBy` avatar on hover
- "Now playing" indicator on the active track (dot + subtle background tint)
- If viewing a non-active playlist: a banner at top reads *"Not playing — [Switch to this playlist]"* link (DJ only)

**Exit criterion:** Track list shows the correct tracks for the selected playlist. Reordering persists after page refresh. "Play" button (when clicked by DJ) updates `servers/{sid}.activePlaylistId` in Firestore and writes the first track to RTDB playback. The "Not playing" banner appears when viewing a playlist different from the one currently in RTDB. Clicking "Switch to this playlist" on the banner changes the active playlist and starts playback from track 1.

---

#### Step P2.4 — Playlist context menu + actions

- Long-press or right-click (desktop: hover reveals `⋯` button) on a playlist item in the sidebar
- Context menu items:
  - **Rename** — inline edit on the sidebar item (click → input appears)
  - **Edit description** — opens a small popover with a textarea
  - **Set as active** — DJ only, switches playback to this playlist
  - **Duplicate** — creates a copy of the playlist with all its tracks (new name = "Copy of X")
  - **Delete** — confirmation prompt: *"Delete [name]? This removes all [n] tracks."*
- Duplicate implementation:
  - Read all tracks from source playlist (`getDocs`)
  - `createPlaylist` with same name prefixed "Copy of"
  - Batch-write all tracks to the new playlist

**Exit criterion:** Renaming inline updates the Firestore document and the sidebar label within 1 second — no page reload needed. Deleting a playlist with 5 tracks deletes the playlist document and all 5 track subdocuments (Firestore console confirms). Duplicating a 10-track playlist creates a new playlist with 10 identical tracks in the same order. The "Set as active" option is only visible to the current DJ (other members do not see it in the context menu).

---

### Step P3 — Playback panel updates

#### Step P3.1 — Now-playing bar — playlist context

- Add playlist name below the track title in the now-playing bar:
  ```
  [thumbnail]  Track Title                    0:42 / 3:21
               Playlist Name · Artist/Channel  [controls]
  ```
- Playlist name links to the active playlist (clicking scrolls the sidebar to it and shows its track list)
- If the viewed playlist ≠ active playlist, a subtle pill badge on the now-playing bar reads: *"Playing from: [name]"*

**Exit criterion:** Now-playing bar shows the correct playlist name. Clicking the playlist name link switches the track list panel to show the active playlist. The "Playing from" badge appears when the viewed playlist differs from the active one and disappears when they match.

---

#### Step P3.2 — "Add to playlist" from now-playing bar

- Right-clicking the now-playing bar (or tapping a `+` icon) opens a small dropdown:
  - Lists all playlists in the server
  - Clicking one adds the current track to that playlist via `addTrackToPlaylist`
  - If the track already exists in that playlist (matched by `sourceId`): show "Already in [name]"

**Exit criterion:** Adding the current playing track to a playlist appends it to `playlists/{pid}/tracks` in Firestore and increments `trackCount`. The track appears in that playlist's track list immediately. Attempting to add a duplicate shows the "Already in" message without writing to Firestore.

---

### Step P5 — Default playlist + migration

#### Step P5.1 — Auto-create default playlist on server creation

Update `createServer` action (from Phase 2 of PLAN.md):

- After writing the `servers/{serverId}` document, immediately create a playlist named **"Queue"** under it
- Write the new `playlistId` back to `servers/{serverId}.defaultPlaylistId` and `activePlaylistId`
- All subsequent track adds (manual, YouTube, SoundCloud, import, LLM) target the active playlist by default

**Exit criterion:** Creating a new server in the app automatically creates a `playlists/` subcollection with one document named "Queue". The server document's `activePlaylistId` and `defaultPlaylistId` fields are set. A brand-new server has exactly one playlist — confirmed in Firestore console.

---

#### Step P5.2 — Migrate existing servers' `queue/` to a playlist

See [Section 7 — Migration Strategy](#7-migration-strategy) for full details. Summary of the code path:

- Create `src/features/playlists/migrateQueue.ts`
- On server page load: check if `servers/{sid}.defaultPlaylistId` is null (old server, not yet migrated)
- If null: read all docs from `servers/{sid}/queue/`, create playlist "Queue", batch-write all tracks, set `defaultPlaylistId` + `activePlaylistId`, delete old `queue/` docs
- Run once per server — idempotent guard: skip if `defaultPlaylistId` is already set

**Exit criterion:** An existing server with 5 tracks in `queue/` loads in the updated app. The playlist sidebar shows "Queue" with 5 tracks. The `queue/` subcollection is deleted from Firestore. The `defaultPlaylistId` and `activePlaylistId` fields are set on the server document. Reloading the app does not re-run the migration. A brand-new server (created after the update) skips migration entirely.

---

## 5. UI Specification

### Layout at desktop (updated)

```
┌─────────┬────────────────┬──────────────────────────────┬──────────────┐
│  Server │ Playlist       │ Track List                   │ Chat + Mbrs  │
│  nav    │ sidebar        │                              │              │
│  60px   │ 200px          │ 1fr                          │ 280px        │
│         │                │                              │              │
│  [icon] │ ▶ Lofi Sundays │  Lofi Sundays                │  [chat]      │
│  [icon] │   Road Trip    │  ───────────────────────     │              │
│  [icon] │   Deep Focus   │  1.  Track Title   3:21      │              │
│         │   ────────     │  2. ▶ Track Title  4:10  ←now playing       │
│         │  ＋ New         │  3.  Track Title   2:55      │              │
│         │                │                              │              │
└─────────┴────────────────┴──────────────────────────────┴──────────────┘
│  ████  Track Title · Lofi Sundays · 0:42 ───────────────────── 3:21  ▶ │
└────────────────────────────────────────────────────────────────────────┘
```

> The "Suggested" recommendations row is added in Phase 6 of PLAN.md.

### Playlist sidebar item anatomy

```
┌─────────────────────────────────┐
│ [img]  Lofi Sundays         ▶▶▶ │  ← waveform bars if active
│        12 tracks · 48 min       │
└─────────────────────────────────┘
```

- Cover image: 36×36px, no border-radius
- Name: `--font-serif` 13px
- Meta: `--font-mono` 11px `--text-3`
- Active state: `3px solid var(--accent)` left border, `--bg-2` background
- Hover state: `--bg-3` background

### Playlist creation modes (pill tabs in modal)

```
[ Empty ]  [ From YouTube ]
```

- Empty: shows only name + description fields
- From YouTube: shows name field + URL input
- All modes: optional cover upload at bottom

> The **"Generate ✦"** (AI) creation mode is added in Phase 6 of PLAN.md once the LLM pipeline is implemented.

### "Not playing" banner

```
┌──────────────────────────────────────────────────────────┐
│  Playing from: Lofi Sundays   [Switch to this playlist]  │
└──────────────────────────────────────────────────────────┘
```

- Background: `--bg-3`
- Text: `--font-mono` 11px `--text-3`
- "Switch" link: `--accent` color, DJ-only (hidden for non-DJ members)
- Hidden when viewed playlist = active playlist

---

## 6. Migration Strategy

### Guiding principle

**Non-destructive. Client-side. Zero downtime.**

The migration runs in the browser when a user (any member) opens an existing server for the first time after the update ships. It is idempotent — safe to run multiple times.

### Migration sequence

```
On server page load:
  │
  ├── Read servers/{serverId}.defaultPlaylistId
  │
  ├── if defaultPlaylistId is set ──→ SKIP (already migrated)
  │
  └── if null ──→ BEGIN MIGRATION
        │
        ├── 1. Read all docs from servers/{serverId}/queue/
        │
        ├── 2. createPlaylist(serverId, 'Queue', serverId.ownerId, 'manual')
        │         → returns newPlaylistId
        │
        ├── 3. Batch-write all queue items to
        │       playlists/{newPlaylistId}/tracks/
        │       (preserve original order values)
        │
        ├── 4. updateDoc servers/{serverId}:
        │       { defaultPlaylistId: newPlaylistId,
        │         activePlaylistId: newPlaylistId }
        │
        ├── 5. Batch-delete all docs in servers/{serverId}/queue/
        │
        └── 6. Update RTDB playback/{serverId}:
                { playlistId: newPlaylistId }
                (if playback is currently active)
```

### Edge cases

| Scenario | Handling |
|---|---|
| Two members open the server at the same time | Firestore transaction on step 4: `defaultPlaylistId` only written if currently null. Second client sees the value set and skips. |
| Server has 0 tracks in `queue/` | Migration still runs — creates an empty "Queue" playlist. |
| Migration fails mid-way (network drop) | `defaultPlaylistId` is written last (step 4). If the page closes after step 3 but before step 4, the next open re-runs from step 1 — duplicate track writes are prevented by checking if `playlists/` already exists with matching track count. |
| Active playback during migration | RTDB playback node gains `playlistId` in step 6. Clients already listening to RTDB re-read their player reference. Since the tracks are in the same order with the same IDs, playback is unaffected. |

### Migration code

```ts
// src/features/playlists/migrateQueue.ts
export async function migrateQueueToPlaylist(
  serverId: string,
  ownerId: string
): Promise<void> {
  const serverRef = doc(db, 'servers', serverId);

  // Atomic check — only proceed if not already migrated
  await runTransaction(db, async (tx) => {
    const serverSnap = await tx.get(serverRef);
    if (serverSnap.data()?.defaultPlaylistId) return; // already done

    // 1. Read existing queue
    const queueSnap = await getDocs(
      collection(db, 'servers', serverId, 'queue')
    );

    // 2. Create "Queue" playlist document inside the transaction
    const playlistRef = doc(collection(db, 'servers', serverId, 'playlists'));
    tx.set(playlistRef, {
      name: 'Queue',
      description: null,
      coverURL: null,
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      trackCount: queueSnap.size,
      totalDuration: queueSnap.docs.reduce((s, d) => s + (d.data().duration ?? 0), 0),
      source: 'manual',
      llmPrompt: null,
      order: 1000,
    });

    // 3. Copy tracks
    queueSnap.docs.forEach((trackDoc) => {
      const trackRef = doc(
        collection(db, 'servers', serverId, 'playlists', playlistRef.id, 'tracks')
      );
      tx.set(trackRef, trackDoc.data());
    });

    // 4. Update server (this is the idempotency guard)
    tx.update(serverRef, {
      defaultPlaylistId: playlistRef.id,
      activePlaylistId: playlistRef.id,
    });

    // 5. Delete old queue docs (inside transaction — Firestore allows up to 500 per tx)
    queueSnap.docs.forEach((d) => tx.delete(d.ref));
  });

  // 6. Update RTDB if playback is active
  const pbSnap = await rtdb.ref(`playback/${serverId}`).get();
  if (pbSnap.exists()) {
    await rtdb.ref(`playback/${serverId}`).update({
      playlistId: (await getDoc(serverRef)).data()?.activePlaylistId,
    });
  }
}
```

> **Firestore transaction limit:** Transactions can read/write up to 500 documents. If a server's `queue/` has more than ~490 tracks (unlikely, but possible after bulk imports), split step 5 (delete old queue) into a post-transaction batch delete.

**Exit criterion:** Open an existing server with 5 legacy queue tracks. Firestore console — before load: `queue/` has 5 docs, `playlists/` does not exist. After load: `queue/` is gone, `playlists/` has one doc named "Queue" with 5 track subdocs. Server document has `defaultPlaylistId` and `activePlaylistId` set. Reloading the server page does not re-run the migration (transaction guard). Two members opening the server simultaneously results in exactly one "Queue" playlist (not two).

---

*Implement Steps P1–P5 in sequence before starting Phase 6 of PLAN.md.
P5.2 (migration) must ship at the same time as P1.1 — never deploy the new
playlist code without the migration guard, or old clients writing to `queue/`
will conflict with new clients expecting `playlists/`.*