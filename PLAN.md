# Listen Together — Implementation Plan

> Synchronized music listening platform. Shared rooms, multi-source audio, friend circles.
> Entirely free to deploy. No backend server. No monthly fee.

---

## Table of Contents

1. [Concept & Features](#1-concept--features)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Implementation Phases](#5-implementation-phases)
6. [Design Language](#6-design-language)
7. [Free Tier Limits](#7-free-tier-limits)
8. [Repo Structure](#8-repo-structure)
9. [Deployment](#9-deployment)
10. [Firestore Security Rules](#10-firestore-security-rules)

---

## 1. Concept & Features

Users log in with Google, create named **Servers** (rooms with a vibe), invite friends, and listen to the same track at the same second. Each server has its own independent playlist queue. Music comes from YouTube, SoundCloud, or any direct URL; entire YouTube playlists can be imported in one action.

| Feature | Description |
|---|---|
| **Auth** | Google sign-in via Firebase. Profile photo + display name pulled automatically. |
| **Servers** | User-created rooms. Each has a name, optional cover art, and its own queue. Users can join multiple servers. |
| **Playback sync** | Firebase RTDB holds playback state (track, position, playing/paused). All clients sync within ~200ms. |
| **Music sources** | YouTube IFrame API (free, no quota), SoundCloud Widget API (free). Spotify excluded — requires Premium per listener. |
| **Playlist import** | YouTube Data API v3 (10k units/day free) fetches all video IDs from a playlist URL. |
| **Friends** | Search by username, send/accept friend requests stored in Firestore. |
| **Server invite** | Share a token-based invite link. Anyone with the link joins the server. |
| **Chat** | Per-server realtime text chat via Firestore `onSnapshot`. |
| **DJ role** | One member controls playback. Server owner can reassign the DJ role. |
| **Presence** | Online/offline status via RTDB `onDisconnect`. |

---

## 2. Tech Stack

Everything runs on permanently free tiers. No credit card required.

| Layer | Service | Plan | Key Limit |
|---|---|---|---|
| Frontend | React + Vite + TypeScript | — | — |
| Styling | Tailwind CSS | — | — |
| Hosting | Cloudflare Pages | Free | Unlimited bandwidth, 500 builds/mo |
| Auth | Firebase Authentication | Spark | 10k sign-ins/mo |
| Database | Cloud Firestore | Spark | 50k reads, 20k writes, 20k deletes/day |
| Realtime sync | Firebase RTDB | Spark | 1 GB storage, 10 GB transfer/mo |
| File storage | Firebase Storage | Spark | 5 GB, 1 GB/day download |
| Music — YouTube | YouTube IFrame Player API | Free | No quota on embeds |
| Music — SoundCloud | SoundCloud Widget API | Free | No quota on public tracks |
| Playlist import | YouTube Data API v3 | Free GCP | 10,000 units/day |
| CI/CD | GitHub Actions | Free | 2,000 min/mo |

> **Why not Spotify?** The Web Playback SDK requires every listener to have Spotify Premium. Not viable for a free, open platform.

---

## 3. Architecture

No backend server to maintain. The client talks directly to Firebase via SDK and to YouTube/SoundCloud via their embed APIs. Cloudflare Pages serves the static bundle.

```
┌──────────────────────────────────────────────────────────┐
│                     CLOUDFLARE PAGES                     │
│               (React SPA — static bundle)                │
└───────────┬──────────────────┬───────────────┬──────────┘
            │                  │               │
            ▼                  ▼               ▼
  ┌──────────────┐   ┌──────────────────┐  ┌────────────────┐
  │ Firebase Auth│   │    Firestore DB   │  │ YouTube IFrame │
  │ Google OAuth │   │                  │  │ API (no quota) │
  │              │   │  users/          │  └────────────────┘
  │  Session JWT │   │  servers/        │
  └──────────────┘   │  queue/          │  ┌────────────────┐
                     │  messages/       │  │ SoundCloud     │
                     └──────────────────┘  │ Widget API     │
                                           └────────────────┘
            ▼
  ┌──────────────────┐       ┌──────────────────────────┐
  │ Firebase RTDB    │       │  YouTube Data API v3     │
  │                  │       │  (playlist import only)  │
  │  playback/{sid}  │       │  10k units/day free      │
  │  ├ trackId       │       └──────────────────────────┘
  │  ├ source        │
  │  ├ position      │  ◄── ALL clients subscribe here
  │  ├ playing       │      and mirror state in real-time
  │  └ updatedAt     │
  └──────────────────┘
```

### Sync Strategy — Core Insight

Only the **DJ** (host) writes to `playback/{serverId}` in RTDB. Every other listener reads the state and seeks their local player to match.

On join, the client calculates the current position as:

```ts
const currentPosition = snapshot.position + (Date.now() - snapshot.updatedAt) / 1000;
player.seekTo(currentPosition);
```

This tolerates network latency without any coordination protocol. Sync lag stays under ~200ms on typical connections. If a listener's local position drifts more than 2 seconds from the RTDB value, it re-syncs automatically.

---

## 4. Data Model

### Firestore Collections

#### `users/{uid}`
```ts
{
  displayName: string;
  photoURL: string;
  username: string;          // unique, lowercase, searchable
  friends: string[];         // array of uid
  friendRequests: {
    from: string;            // uid
    status: 'pending' | 'accepted' | 'rejected';
  }[];
  createdAt: Timestamp;
}
```

#### `servers/{serverId}`
```ts
{
  name: string;
  coverURL: string | null;
  ownerId: string;           // uid
  members: string[];         // uid[]
  djId: string;              // uid — who controls playback
  inviteToken: string;       // random slug for invite link
  createdAt: Timestamp;
}
```

#### `servers/{serverId}/queue/{itemId}`
```ts
{
  source: 'youtube' | 'soundcloud' | 'url';
  sourceId: string;          // YT videoId or SC track URL
  title: string;
  thumbnail: string;
  duration: number;          // seconds
  addedBy: string;           // uid
  order: number;             // for drag-to-reorder (use fractional indexing)
  addedAt: Timestamp;
}
```

#### `servers/{serverId}/messages/{msgId}`
```ts
{
  text: string;
  userId: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp;
}
```

> Keep only the last 200 messages per server to stay within free quota. Delete older ones on each write using a batch delete trigger (run client-side after posting).

### Firebase RTDB

#### `playback/{serverId}`
```json
{
  "trackId": "queue item id",
  "source": "youtube",
  "sourceId": "dQw4w9WgXcQ",
  "position": 42.5,
  "playing": true,
  "updatedAt": 1715000000000,
  "djId": "uid-of-current-dj"
}
```

#### `presence/{uid}`
```json
{
  "online": true,
  "activeServerId": "server-id-or-null",
  "lastSeen": 1715000000000
}
```

---

## 5. Implementation Phases

Each step has granular sub-tasks and a clear **exit criterion** — the single condition that proves the step is done before moving on.

---

### Phase 1 — Foundation + Auth (Week 1–2)

#### Step 1.1 — Scaffold the project

```bash
npm create vite@latest listentogether -- --template react-ts
cd listentogether
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom
```

- Configure `tailwind.config.ts` — set `content` to `["./index.html", "./src/**/*.{ts,tsx}"]`
- Add Tailwind directives to `src/styles/globals.css`
- Create `src/styles/theme.css` with CSS custom properties from the Design Language section
- Import both files in `main.tsx`
- Delete Vite boilerplate (`App.css`, logo, counter)
- Set `<title>Listen Together</title>` in `index.html`

**Exit criterion:** `npm run dev` starts without errors. `localhost:5173` renders a blank dark page (background `#0f0e0c`). `npm run build` completes with zero TypeScript errors.

---

#### Step 1.2 — Set up Firebase project

- Go to [console.firebase.google.com](https://console.firebase.google.com) → Create project → name it `listentogether`
- Disable Google Analytics (not needed)
- Build → Authentication → Get started → Sign-in method → Enable **Google**
- Build → Firestore Database → Create database → **Production mode** (us-central1)
- Build → Realtime Database → Create database → **Locked mode** (us-central1)
- Build → Storage → Get started → **Production mode**
- Project Settings → General → Your apps → Add app → Web → register as `listentogether-web`
- Copy the Firebase config object

**Exit criterion:** Firebase console shows all four services (Auth, Firestore, RTDB, Storage) as active with green status. The config object is copied locally.

---

#### Step 1.3 — Wire up Firebase SDK

```bash
npm install firebase
```

- Create `.env.example` with all `VITE_FIREBASE_*` keys and `VITE_YT_API_KEY` (empty values)
- Create `.env.local` with the real values from the Firebase config (never commit this)
- Add `.env.local` to `.gitignore`
- Create `src/app/firebase.ts`:
  - Initialize app with `initializeApp(firebaseConfig)`
  - Export `auth` (`getAuth`), `db` (`getFirestore`), `rtdb` (`getDatabase`), `storage` (`getStorage`)

**Exit criterion:** `import { auth } from './firebase'` in any component resolves without runtime error. Firebase console → Authentication shows the web app registered. No secrets committed to git (`git log --all -- .env.local` returns nothing).

---

#### Step 1.4 — Auth context + `useAuth` hook

- Create `src/features/auth/AuthProvider.tsx`:
  - Wraps app in `AuthContext`
  - Calls `onAuthStateChanged` on mount
  - Exposes `{ user: User | null, loading: boolean }`
- Create `src/features/auth/useAuth.ts` — convenience hook that reads the context
- Wrap `<App />` in `<AuthProvider>` in `main.tsx`

**Exit criterion:** `useAuth()` returns `{ user: null, loading: false }` on a fresh page load (no sign-in yet). `loading` is `true` for the brief period Firebase resolves the session, then flips to `false`. Verified in React DevTools.

---

#### Step 1.5 — Sign-in page

- Create `src/features/auth/SignInPage.tsx`:
  - Full-screen centered layout
  - App name in `--font-serif`, large
  - "Continue with Google" button calls `signInWithPopup(auth, new GoogleAuthProvider())`
  - Loading state while popup is resolving
- Add route `/signin` in `src/app/routes.tsx`
- Add `<RouterProvider>` in `App.tsx`

**Exit criterion:** Clicking the button opens a Google account picker popup. Selecting an account closes the popup. `useAuth().user` is non-null immediately after. The browser console shows no errors. The Firebase console → Authentication → Users shows the new user entry.

---

#### Step 1.6 — Username setup (first sign-in flow)

- After sign-in, check Firestore for `users/{uid}` document
- If it does not exist → redirect to `/setup` (username picker)
- Create `src/features/auth/UsernameSetup.tsx`:
  - Text input for username (lowercase, alphanumeric, 3–20 chars)
  - On submit: query `where('username', '==', value)` to check uniqueness
  - If unique: write `users/{uid}` document with `displayName`, `photoURL`, `username`, `friends: []`, `friendRequests: []`, `createdAt`
  - Redirect to `/` on success
- Validate: no spaces, no special chars, length 3–20

**Exit criterion:** A brand-new Google account is redirected to `/setup`. Submitting a taken username shows an inline error. Submitting a unique username writes the Firestore document and redirects to `/`. Verified in Firebase console → Firestore → users collection.

---

#### Step 1.7 — Protected route + app shell

- Create `src/features/auth/ProtectedRoute.tsx`:
  - While `loading` → render nothing (or a minimal spinner)
  - If `!user` → redirect to `/signin`
  - If `user` exists but no Firestore profile → redirect to `/setup`
  - Otherwise → render `<Outlet />`
- Create a bare `src/features/servers/HomePage.tsx` (placeholder `<div>Home</div>`)
- Nest all main routes under `<ProtectedRoute>`

**Exit criterion:** Visiting `/` while signed out redirects to `/signin`. Visiting `/signin` while signed in redirects to `/`. After completing username setup, `/setup` is not accessible again (redirects to `/`). Hard-refreshing the page does not flash the sign-in screen for an already-authenticated user.

---

#### Step 1.8 — Deploy to Cloudflare Pages

- Push repo to GitHub (public or private, both work)
- Cloudflare Dashboard → Pages → Create project → Connect to Git → select repo
- Build command: `npm run build` · Output directory: `dist`
- Add all `VITE_*` environment variables in the Pages settings UI
- Add `_redirects` file to `public/` with content: `/* /index.html 200` (SPA fallback)
- Trigger first deploy

**Exit criterion:** Cloudflare Pages shows a green "Success" deploy. The `*.pages.dev` URL loads the sign-in page. Google sign-in works on the live URL (add the Pages domain to Firebase → Authentication → Authorized domains).

---

### Phase 2 — Servers + Queue (Week 3–4)

#### Step 2.1 — Three-panel app shell layout

- Create `src/features/servers/AppLayout.tsx` with CSS Grid:
  - Left sidebar: `220px` fixed — server list + friends
  - Main panel: `1fr` — queue + now-playing area
  - Right rail: `280px` fixed — chat + member list
- Add `overflow: hidden` on root; individual panels handle their own scroll
- Sidebar and rail collapse to bottom tab bar on `< 768px` (CSS only for now)

**Exit criterion:** Layout renders three panels at desktop width. Resizing below 768px shows a single full-width panel. No horizontal scrollbar at any width. Panels are visually distinct (different `--bg-2` / `--bg-3` backgrounds).

---

#### Step 2.2 — Create server

- Create `src/features/servers/CreateServerModal.tsx`:
  - Text input: server name (required, max 40 chars)
  - Optional image upload → `ref(storage, 'covers/{serverId}')` → get download URL
  - On submit: write to `servers/{serverId}` with `name`, `coverURL`, `ownerId: uid`, `members: [uid]`, `djId: uid`, `inviteToken: nanoid(10)`, `createdAt`
  - Close modal and navigate to `/server/:serverId`
- Install `nanoid` for invite token generation

**Exit criterion:** Submitting the form creates a Firestore document visible in Firebase console. The new server appears in the sidebar immediately (optimistic or via realtime listener). Uploading a cover image stores it in Firebase Storage and the `coverURL` field is populated. Submitting without a name shows a validation error.

---

#### Step 2.3 — Server list + realtime listener

- Create `src/features/servers/useServers.ts`:
  - Firestore query: `where('members', 'array-contains', uid)`, `orderBy('createdAt', 'desc')`
  - `onSnapshot` listener — returns live array of servers
- Create `src/features/servers/ServerList.tsx`:
  - Renders each server as a sidebar item (cover art thumbnail or initial letter, server name)
  - Active server highlighted
  - "+" button to open CreateServerModal

**Exit criterion:** After creating two servers in two browser tabs, both appear in each tab's sidebar without a page refresh. Deleting a server (Firestore doc removed manually in console) removes it from the sidebar within 1 second.

---

#### Step 2.4 — Server invite link + join flow

- Create `/join/:token` route → `src/features/servers/InvitePage.tsx`
- On load: query `where('inviteToken', '==', token)` to find the server
- If found and user is not already a member: show server name + "Join" button
- On join: `arrayUnion(uid)` on `servers/{serverId}.members`
- If already a member: redirect directly to `/server/:serverId`
- Add "Copy invite link" button in server settings (copies `window.location.origin + '/join/' + inviteToken`)

**Exit criterion:** Opening the invite link in an incognito window (after signing in) shows the server name and a Join button. Clicking Join adds the UID to `members` in Firestore and redirects to the server. A second click on the same link (already a member) redirects without showing the join screen. An invalid token shows a "Link not found" message.

---

#### Step 2.5 — Queue — add track by URL

- Create `src/features/queue/AddTrackModal.tsx`:
  - Single URL input field
  - On submit: detect source from URL (`parseYouTubeVideoId`, `parseSoundCloudUrl`)
  - Fetch track metadata:
    - YouTube: `https://www.youtube.com/oembed?url={url}&format=json` (no API key needed) → title + thumbnail
    - SoundCloud: `https://soundcloud.com/oembed?url={url}&format=json` → title + thumbnail
  - Write to `servers/{serverId}/queue/{nanoid()}` with `source`, `sourceId`, `title`, `thumbnail`, `duration`, `addedBy`, `order: (lastOrder + 1000)`, `addedAt`
- Create `src/features/queue/useQueue.ts`:
  - `onSnapshot` on `queue` subcollection, `orderBy('order', 'asc')`

**Exit criterion:** Pasting a YouTube URL and submitting adds a track to the queue with title and thumbnail populated. Pasting a SoundCloud URL does the same. Pasting an unrecognized URL shows "Unsupported source" error. The added track appears in all open tabs within 1 second.

---

#### Step 2.6 — Queue — import YouTube playlist

- Create `src/features/queue/importPlaylist.ts`:
  - Accept a playlist URL → `parseYouTubePlaylistId(url)`
  - Call YouTube Data API v3: `GET /youtube/v3/playlistItems?part=snippet&playlistId={id}&maxResults=50&key={VITE_YT_API_KEY}`
  - Paginate via `nextPageToken` until all items fetched (or cap at 200 items)
  - Map each item to a queue entry (title, thumbnail, videoId)
  - Batch-write all items to Firestore in chunks of 500 (Firestore batch limit)
- Show progress: "Importing 1 of 47…" during fetch

**Exit criterion:** Pasting a YouTube playlist URL with 10 videos imports all 10 tracks in one action. Each track has correct title and thumbnail. A playlist with 60 videos imports correctly (requires pagination). The Firebase console → Firestore shows all items written. The YouTube Data API quota usage is visible in Google Cloud Console → APIs & Services.

---

#### Step 2.7 — Queue — reorder + remove

- Install `@dnd-kit/core` and `@dnd-kit/sortable` for drag-to-reorder
- Wrap queue list in `<SortableContext>` — on drag end, compute new `order` value using fractional indexing (`order = (prevOrder + nextOrder) / 2`)
- Write updated `order` to Firestore on drag end (single document update)
- Rebalance when any gap < `0.001` (reassign all as `1000, 2000, 3000…`)
- Add remove button (×) on each track row → `deleteDoc` on the queue item

**Exit criterion:** Dragging a track to a new position persists after page refresh. The order is correct when viewed from a second browser tab. Removing a track deletes it from Firestore and removes it from all clients' queues immediately. After 20 reorders on the same two items, the `order` values remain distinct (no collision).

---

#### Step 2.8 — Firestore security rules v1

- Write `firestore.rules` (see Section 10 for full rules)
- Deploy: `firebase deploy --only firestore:rules`
- Test: signed-out `curl` to Firestore REST API returns 403

**Exit criterion:** A user who is not in `members` cannot read `servers/{serverId}` — Firebase console → Rules Playground confirms "Denied". A user who is in `members` can read their own server — Rules Playground confirms "Allowed". A user cannot write to another user's `users/{uid}` document — confirmed "Denied".

---

### Phase 3 — Synchronized Playback (Week 5–6)

#### Step 3.1 — YouTube IFrame player component

- Load YouTube IFrame API script once globally (append `<script>` in `useEffect`, guard with `window.YT` check)
- Create `src/features/playback/YouTubePlayer.tsx`:
  - Accepts `videoId: string`, `onReady`, `onEnd` callbacks
  - Mounts a `<div id="yt-player">` and calls `new window.YT.Player(...)`
  - Exposes imperative handle via `useImperativeHandle`: `play()`, `pause()`, `seekTo(seconds)`, `getCurrentTime()`, `getDuration()`
  - Player div is `width: 1, height: 1, position: absolute, opacity: 0` — audio only, no visible video

**Exit criterion:** Calling `playerRef.current.play()` from a button audibly plays a YouTube video. `pause()` stops it. `seekTo(30)` jumps to 0:30. `onEnd` fires when the track finishes. The player `<div>` is not visible on screen. Works in Chrome, Firefox, and Safari.

---

#### Step 3.2 — SoundCloud widget component

- Create `src/features/playback/SoundCloudPlayer.tsx`:
  - Load SoundCloud Widget API script once globally
  - Hidden `<iframe src="https://w.soundcloud.com/player/?url={encodedUrl}&auto_play=false">` 
  - Bind `SC.Widget(iframe)` and expose same handle interface: `play()`, `pause()`, `seekTo(ms)`, `getCurrentTime()` (note: SC uses milliseconds)
  - Normalize to seconds in the handle to match YouTube interface

**Exit criterion:** Same test as Step 3.1 but with a SoundCloud URL. `seekTo(30)` jumps to 0:30 (30,000ms internally). Both players implement an identical `PlayerHandle` interface — TypeScript confirms with no type errors.

---

#### Step 3.3 — `usePlaybackSync` hook — DJ write path

- Create `src/features/playback/usePlaybackSync.ts`
- If `isDJ === true`:
  - `play()` → write `{ playing: true, position: currentTime, updatedAt: Date.now() }` to `rtdb playback/{serverId}`
  - `pause()` → write `{ playing: false, position: currentTime, updatedAt: Date.now() }`
  - `seekTo(t)` → write `{ position: t, updatedAt: Date.now() }`
  - `setTrack(item)` → write `{ trackId, source, sourceId, position: 0, playing: true, updatedAt: Date.now() }`
- Writes use `rtdb.ref('playback/{serverId}').update(patch)` (not `set` — partial updates only)

**Exit criterion:** DJ clicks play → Firebase console → RTDB → `playback/{serverId}` shows `playing: true` and a `position` value. DJ clicks pause → shows `playing: false`. DJ seeks → `position` updates. All writes appear within 100ms in the RTDB console.

---

#### Step 3.4 — `usePlaybackSync` hook — listener read path

- If `isDJ === false`:
  - Subscribe to `onValue(rtdb.ref('playback/{serverId}'), callback)`
  - On each snapshot:
    - Compute `target = snapshot.position + (Date.now() - snapshot.updatedAt) / 1000`
    - If `Math.abs(target - player.getCurrentTime()) > 2` → call `player.seekTo(target)`
    - If `snapshot.playing !== isCurrentlyPlaying` → call `player.play()` or `player.pause()`
  - If `snapshot.trackId !== currentTrackId` → swap player source, then seek to `target`
- Unsubscribe in cleanup

**Exit criterion:** Open two browser tabs (Tab A = DJ, Tab B = listener). DJ plays a track in Tab A. Tab B starts playing within 500ms. DJ seeks to 1:00 in Tab A. Tab B jumps to ~1:00 within 500ms. DJ pauses — Tab B pauses. DJ skips to the next track — Tab B switches track. Closing Tab B and reopening it joins at the correct position.

---

#### Step 3.5 — Player switcher + now-playing bar

- Create `src/features/playback/PlayerBar.tsx`:
  - Renders `<YouTubePlayer>` or `<SoundCloudPlayer>` based on `playbackState.source`
  - Fixed bottom bar: thumbnail (40×40), title (truncated), artist
  - Scrubber: `<input type="range">` 1px height — DJ only (listener scrubber is read-only visual)
  - Play/pause button — DJ only (listeners see a lock icon)
  - Skip button — DJ only
  - Current time / duration display in `--font-mono`
- Scrubber updates every second via `setInterval` reading `player.getCurrentTime()`

**Exit criterion:** Now-playing bar shows the correct title and thumbnail for the active track. Scrubber advances in real time. DJ dragging the scrubber seeks all listeners. Listener's scrubber moves but cannot be dragged. Switching between a YouTube and SoundCloud track swaps the hidden player without a visible glitch.

---

#### Step 3.6 — Auto-advance + DJ handoff

- On `onEnd` callback from the active player:
  - Only the DJ handles this event
  - Find the next item in the queue (by `order`, after the current `trackId`)
  - If found: write new track to RTDB `playback/{serverId}`
  - If queue is exhausted: write `playing: false` to RTDB
- DJ handoff:
  - Server owner sees a "Make DJ" option in the members list context menu
  - On click: update `servers/{serverId}.djId` in Firestore
  - `usePlaybackSync` re-evaluates `isDJ` based on `djId === currentUser.uid`

**Exit criterion:** After a track ends, the next queue item begins playing on all clients automatically. After the last track ends, playback stops. Server owner can transfer the DJ role — new DJ's controls become active and old DJ's controls become locked within 1 second. Verified across two browser tabs.

---

### Phase 4 — Friends + Chat (Week 7–8)

#### Step 4.1 — RTDB presence

- Create `src/shared/hooks/usePresence.ts`:
  - On mount: `rtdb.ref('presence/{uid}').set({ online: true, activeServerId: null, lastSeen: Date.now() })`
  - `rtdb.ref('presence/{uid}').onDisconnect().update({ online: false, lastSeen: serverTimestamp() })`
  - When user navigates to a server: update `activeServerId`
  - On unmount / sign-out: manually call `.set({ online: false })`
- Call `usePresence()` once at the top level inside `<ProtectedRoute>`

**Exit criterion:** Sign in → Firebase console → RTDB → `presence/{uid}` shows `online: true`. Close the browser tab → within 10 seconds, `online` flips to `false` (RTDB onDisconnect fires on connection drop). Switching servers updates `activeServerId`.

---

#### Step 4.2 — Username search + friend request

- Create `src/features/friends/FriendSearch.tsx`:
  - Debounced text input (300ms) querying Firestore: `where('username', '>=', q), where('username', '<=', q + '\uf8ff'), limit(10)`
  - Exclude current user from results
  - Each result shows avatar + username + "Add friend" button
  - On "Add friend": `arrayUnion` a `{ from: currentUid, status: 'pending' }` object to target's `friendRequests`

**Exit criterion:** Typing "al" returns all usernames starting with "al" within 300ms. "Add friend" button sends the request (visible in target user's Firestore `friendRequests`). Sending a second request to the same user is idempotent (button shows "Pending"). Searching for own username does not show the current user in results.

---

#### Step 4.3 — Friend request inbox + accept/reject

- Create `src/features/friends/FriendRequests.tsx`:
  - Listen to `users/{uid}.friendRequests` where `status === 'pending'`
  - Each pending request shows sender's avatar + username (fetched by UID) + Accept / Reject buttons
  - Accept: add both UIDs to each other's `friends` array; update request `status` to `'accepted'`
  - Reject: update request `status` to `'rejected'`
- Show badge count on friends icon in sidebar when pending requests > 0

**Exit criterion:** User A sends a request to User B. User B sees the request appear in their inbox in real time. Accepting adds both users to each other's `friends` array (confirmed in Firestore). Rejecting updates the status without modifying `friends`. The pending badge disappears after all requests are resolved.

---

#### Step 4.4 — Friends list with presence

- Create `src/features/friends/FriendsList.tsx`:
  - Read `users/{uid}.friends` → batch-fetch each friend's `users/{fid}` doc
  - Subscribe to `presence/{fid}` in RTDB for each friend — show green dot if `online: true`
  - Show which server each online friend is in (if `activeServerId` is set)
  - "Join" button that navigates to that server (if current user is already a member)

**Exit criterion:** Friends list shows all accepted friends. Online friends have a green dot. The server name shown next to an online friend updates when they switch servers (within 2 seconds). Offline friends are listed below online friends. Clicking "Join" navigates to the correct server route.

---

#### Step 4.5 — Per-server realtime chat

- Create `src/features/chat/useChat.ts`:
  - `onSnapshot` on `servers/{serverId}/messages`, `orderBy('createdAt', 'asc')`, `limitToLast(50)`
  - Returns `messages[]` as live array
- Create `src/features/chat/ChatRail.tsx`:
  - Scrollable message list (auto-scrolls to bottom on new message)
  - Each message: avatar + username + text + timestamp in `--font-mono`
  - Text input + send button at bottom
- On send:
  - `addDoc` to `messages` subcollection
  - Count messages; if count > 200, delete the oldest batch (query first 10, `deleteDoc` each)

**Exit criterion:** Typing in Tab A and sending shows the message in Tab B within 500ms. Sending 201 messages total — oldest messages are pruned, Firestore document count stays at ≤ 200 (verified in console). Chat scrolls to the latest message automatically. Sending an empty message is blocked by input validation.

---

### Phase 5 — UI Polish + Art Direction (Week 9–10)

#### Step 5.1 — Typography + color system

- Install fonts: `Playfair Display` + `DM Mono` via Google Fonts (`<link>` in `index.html`)
- Apply `--font-serif` to: server names, now-playing title, page headings, empty state quotes
- Apply `--font-mono` to: timestamps, track durations, member counts, username display
- Apply `--font-sans` (DM Sans) to: body text, buttons, input labels
- Audit every text element — no system fonts, no Inter, no Roboto

**Exit criterion:** DevTools → computed styles for the now-playing title shows `Playfair Display`. Track duration shows `DM Mono`. No element uses a system font fallback as the primary. Screenshot at 1440px width looks intentionally typographic, not like a default React app.

---

#### Step 5.2 — Color Thief dynamic accent

- Install `colorthief` package
- Implement `src/shared/hooks/useColorThief.ts` (see Key Implementation Notes)
- Call it in `PlayerBar.tsx` whenever `playbackState.sourceId` changes
- Apply `--accent` to: play button, active queue item highlight, scrubber thumb, DJ badge, online dot
- Add CSS transition on `--accent`: `transition: --accent 0.6s ease` (use `@property` for smooth transition in Chromium)

**Exit criterion:** Playing a track with a red thumbnail shifts accent to warm red. Playing a track with a blue thumbnail shifts accent to blue. The transition between accents is smooth (~0.6s). Tracks without a fetchable thumbnail fall back to the default `--accent: #c44b2b`. No CORS errors in the console (YouTube thumbnails support `crossOrigin: anonymous`).

---

#### Step 5.3 — Grain texture + visual depth

- Add SVG grain filter to `globals.css`:
  ```css
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,..."); /* feTurbulence noise */
    opacity: 0.035;
    pointer-events: none;
    z-index: 9999;
  }
  ```
- Use `feTurbulence` with `baseFrequency="0.65"` and `stitchTiles="stitch"` for seamless tiling
- Panel borders: `1px solid var(--rule)` (`rgba(232,229,223,0.08)`)
- Sidebar server items: left border `3px solid transparent`; active state: `3px solid var(--accent)`

**Exit criterion:** At 100% zoom, a subtle grain texture is visible over the entire page surface. The texture does not flicker or animate. The texture does not block clicks (confirm with DevTools → pointer events). Panel borders are barely visible — present but not prominent.

---

#### Step 5.4 — Animations

- Now-playing card: `animation: pulse 4s ease-in-out infinite` — subtle `scale(1)` → `scale(1.008)` breathing
- Waveform playing indicator (`WaveformBars.tsx`): three `<span>` bars, CSS `scaleY` keyframe animation, staggered `animation-delay`
- Cover art crossfade: on `sourceId` change, fade out old image (opacity 0, 300ms), swap `src`, fade in (opacity 1, 300ms)
- Queue item add: new items slide in from `translateY(8px)` with `opacity: 0` → `opacity: 1`
- All animations wrapped in `@media (prefers-reduced-motion: no-preference)` — static fallback for reduced-motion users

**Exit criterion:** Playing state shows animated waveform bars. Pausing stops the bars (CSS `animation-play-state: paused`). Switching tracks fades the cover art smoothly. Adding a queue item animates in. `prefers-reduced-motion: reduce` in OS settings disables all animations — verified in DevTools → Rendering → Emulate.

---

#### Step 5.5 — Mobile layout

- Below `768px`:
  - Hide sidebar and right rail (both `display: none`)
  - Main panel fills full width
  - Fixed bottom tab bar with 3 tabs: Queue, Chat, Members
  - Tapping a tab slides in a full-height drawer from the bottom
  - Now-playing bar sits above the tab bar
- Drawer open state managed with `useState` — no external library
- Prevent body scroll when drawer is open (`overflow: hidden` on `body`)

**Exit criterion:** On a real iOS or Android device (or DevTools mobile emulation at 390px width), the three-panel layout collapses to a single-panel view. All three tabs are reachable. The now-playing bar is always visible. Drawer opens and closes with no visible jank. Touch targets are at least 44×44px.

---

#### Step 5.6 — Empty states

- No servers: italic serif quote about listening in the main panel center
- No tracks in queue: quote about silence or music (rotate through 3–4 options)
- No chat messages: "The room is quiet." in `--font-mono --text-3`
- No friends: short editorial line — not a CTA, not an illustration
- All empty states use `--font-serif` italic for the quote line; `--font-mono` `--text-3` for subtext

**Exit criterion:** Each empty state is reachable via a fresh account. No empty state contains a cartoon, an emoji, or a generic "Add your first X!" call to action. Each reads as editorial copy, not onboarding.

---

#### Step 5.7 — Firestore security rules v2 + RTDB rules

- Deploy final `firestore.rules` (see Section 10) with:
  - Invite token validation on server join (verify token matches before adding to members)
  - Message create: validate `text` is non-empty string, length ≤ 500
  - Queue write: validate required fields present (`source`, `sourceId`, `title`)
- Deploy `database.rules.json` (see Section 10)
- Run Firebase Rules Playground for all 8 key scenarios

**Exit criterion:** All 8 Rules Playground scenarios pass:
1. Unauthenticated read of any document → Denied
2. Member reads their server → Allowed
3. Non-member reads a server → Denied
4. User writes own profile → Allowed
5. User writes another profile → Denied
6. Member adds queue item → Allowed
7. Non-DJ writes RTDB playback → Denied
8. DJ writes RTDB playback → Allowed

---

#### Step 5.8 — Performance audit

- Add `React.lazy` + `Suspense` for route-level code splitting (`SignInPage`, `UsernameSetup`, `InvitePage`)
- Lazy-load `YouTubePlayer` and `SoundCloudPlayer` — only mount when a track is active
- Add `loading="lazy"` to all `<img>` elements outside the viewport
- Run `npm run build` — check bundle sizes in `dist/assets/`. Main chunk should be under 200KB gzipped
- Run Lighthouse in Chrome DevTools against the Cloudflare Pages URL (not localhost)

**Exit criterion:** Lighthouse scores on the Cloudflare Pages URL: Performance ≥ 85, Accessibility ≥ 90, Best Practices ≥ 90. Main JS chunk ≤ 200KB gzipped (verified in build output). No layout shift visible during page load (CLS < 0.1). First Contentful Paint < 1.5s on a simulated Fast 3G connection.

---

## 6. Design Language

The interface takes cues from record sleeve design, music press editorial, and brutalist web typography — not SaaS dashboards.

### Principles

| Principle | Implementation |
|---|---|
| **Typography** | Two typefaces only: high-contrast serif (Playfair Display or GT Alpina) for display moments, monospace (DM Mono) for metadata. No humanist sans. |
| **Color** | Near-black background `#0f0e0c`. Off-white text `#e8e5df`. Single warm accent extracted from current track thumbnail via Color Thief. Rest is neutral grays. |
| **Layout** | Three-panel: sidebar (servers + friends) · main (queue + player) · rail (chat + members). No rounded corners on containers. Sharp edges only. |
| **Texture** | Subtle grain noise overlay via SVG `<feTurbulence>` filter on body. Adds depth without color. |
| **Motion** | Now-playing card pulses with `scale` keyframe. Track scrubber is a 1px hairline. Cover art fades on track change (opacity crossfade). Playing state = 3-bar waveform CSS animation. |
| **Empty states** | Italic serif quotes about music or silence. No illustrations. No generic onboarding CTAs. |
| **Feedback** | Sync lag shows as soft `syncing…` text label, never a spinner. Queue additions animate in from below. |

### CSS Custom Properties (theme.css)

```css
:root {
  /* Base */
  --bg: #0f0e0c;
  --bg-2: #1a1916;
  --bg-3: #242320;
  --text: #e8e5df;
  --text-2: #9b9890;
  --text-3: #5a5850;
  --rule: rgba(232, 229, 223, 0.08);

  /* Accent — overridden dynamically by Color Thief */
  --accent: #c44b2b;
  --accent-dim: rgba(196, 75, 43, 0.15);

  /* Typography */
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-mono: 'DM Mono', 'Courier New', monospace;
  --font-sans: 'DM Sans', system-ui, sans-serif;

  /* Spacing */
  --sidebar-w: 220px;
  --rail-w: 280px;
  --player-h: 72px;
}
```

---

## 7. Free Tier Limits

| Service | Free Limit | Approx. capacity | Watch for |
|---|---|---|---|
| Cloudflare Pages | Unlimited bandwidth, 500 builds/mo | Unlimited visitors | Build count if deploying often |
| Firebase Auth | 10,000 sign-ins/mo | ~300 DAU | — |
| Firestore | 50k reads · 20k writes · 20k deletes/day | ~100 DAU moderate use | Reads burn fast with `onSnapshot` |
| Firebase RTDB | 1 GB storage · 10 GB transfer/mo | ~200 concurrent listeners | Transfer if many active rooms |
| Firebase Storage | 5 GB · 1 GB/day download | ~2,000 server cover images | — |
| YouTube Data API v3 | 10,000 units/day | ~100 playlist imports/day | Each `playlistItems.list` = 1 unit per page |
| YouTube IFrame API | No quota | Unlimited | — |
| SoundCloud Widget | No quota | Unlimited (public tracks) | — |
| GitHub Actions | 2,000 min/mo | ~60 deployments/mo | — |

### Firestore Quota Strategy

- Use **RTDB** (not Firestore) for all high-frequency state — playback, presence. RTDB charges only bandwidth, not per-operation.
- Always query with a `serverId` filter. Never listen to an entire collection.
- Limit chat `onSnapshot` to the last 50 messages with `.orderBy('createdAt', 'desc').limit(50)`.
- Cache server metadata in `sessionStorage` — re-read from Firestore only on stale data.
- Batch queue writes where possible (e.g. playlist import = one batch write, not N individual writes).

---

## 8. Repo Structure

```
listentogether/
├── public/
│   └── favicon.svg
│
├── src/
│   ├── app/
│   │   ├── App.tsx               # Router + AuthProvider wrapper
│   │   ├── firebase.ts           # Firebase SDK init (all services)
│   │   └── routes.tsx            # Route definitions
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx   # Context + onAuthStateChanged
│   │   │   ├── useAuth.ts
│   │   │   ├── SignInPage.tsx
│   │   │   └── UsernameSetup.tsx  # First sign-in flow
│   │   │
│   │   ├── servers/
│   │   │   ├── useServers.ts      # Firestore query for user's servers
│   │   │   ├── ServerList.tsx     # Sidebar server list
│   │   │   ├── CreateServer.tsx   # Modal
│   │   │   ├── ServerPage.tsx     # Main panel
│   │   │   └── InvitePage.tsx     # /join/:token route
│   │   │
│   │   ├── queue/
│   │   │   ├── useQueue.ts        # Firestore subcollection listener
│   │   │   ├── QueuePanel.tsx     # Ordered track list + drag reorder
│   │   │   ├── AddTrackModal.tsx  # URL input + source detection
│   │   │   └── importPlaylist.ts  # YouTube Data API v3 fetch
│   │   │
│   │   ├── playback/
│   │   │   ├── usePlaybackSync.ts # RTDB listener + DJ write logic
│   │   │   ├── PlayerBar.tsx      # Now-playing bar (bottom)
│   │   │   ├── YouTubePlayer.tsx  # Hidden YT iframe + YT.Player API
│   │   │   └── SoundCloudPlayer.tsx # Hidden SC iframe + SC.Widget API
│   │   │
│   │   ├── chat/
│   │   │   ├── useChat.ts         # onSnapshot last 50 messages
│   │   │   ├── ChatRail.tsx       # Right panel
│   │   │   └── MessageInput.tsx
│   │   │
│   │   └── friends/
│   │       ├── useFriends.ts
│   │       ├── FriendSearch.tsx
│   │       └── FriendRequests.tsx
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── WaveformBars.tsx   # CSS animated playing indicator
│   │   ├── hooks/
│   │   │   ├── usePresence.ts     # RTDB onDisconnect
│   │   │   └── useColorThief.ts   # Extract accent from thumbnail
│   │   └── utils/
│   │       ├── youtubeUtils.ts    # Parse video/playlist IDs from URLs
│   │       ├── soundcloudUtils.ts # Validate SC track URLs
│   │       └── fractionalIndex.ts # Drag-to-reorder order values
│   │
│   └── styles/
│       ├── globals.css
│       └── theme.css              # CSS custom properties
│
├── firestore.rules
├── database.rules.json
├── .env.example
├── vite.config.ts
└── package.json
```

---

## 9. Deployment

### Cloudflare Pages Setup

1. Push repo to GitHub
2. Cloudflare Dashboard → Pages → Connect to Git → select repo
3. Build settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Add environment variables in Pages settings (not committed to repo):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_URL
VITE_YT_API_KEY
```

### `.env.example`
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_YT_API_KEY=
```

### GitHub Actions (`.github/workflows/deploy.yml`)
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
          VITE_YT_API_KEY: ${{ secrets.VITE_YT_API_KEY }}
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: listentogether
          directory: dist
```

---

## 10. Firestore Security Rules

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — anyone authenticated can read (for friend search)
    // Only the owner can write their own document
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Servers — only members can read
    // Only owner can update server metadata
    // Any member can join (handled via invite token check in client)
    match /servers/{serverId} {
      allow read: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.members;
      allow delete: if request.auth.uid == resource.data.ownerId;

      // Queue — members only
      match /queue/{itemId} {
        allow read, write: if request.auth.uid in
          get(/databases/$(database)/documents/servers/$(serverId)).data.members;
      }

      // Messages — members only, no delete (read-only history)
      match /messages/{msgId} {
        allow read: if request.auth.uid in
          get(/databases/$(database)/documents/servers/$(serverId)).data.members;
        allow create: if request.auth.uid in
          get(/databases/$(database)/documents/servers/$(serverId)).data.members;
      }
    }
  }
}
```

### `database.rules.json` (Firebase RTDB)
```json
{
  "rules": {
    "playback": {
      "$serverId": {
        ".read": "auth != null",
        ".write": "auth != null && data.child('djId').val() === auth.uid"
      }
    },
    "presence": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

---

## Key Implementation Notes

### YouTube URL Parsing
```ts
// youtubeUtils.ts
export function parseYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function parseYouTubePlaylistId(url: string): string | null {
  const m = url.match(/[?&]list=([^?&]+)/);
  return m ? m[1] : null;
}
```

### Playback Sync Hook (skeleton)
```ts
// usePlaybackSync.ts
export function usePlaybackSync(serverId: string, isDJ: boolean) {
  const playerRef = useRef<PlayerHandle>(null);

  useEffect(() => {
    const ref = rtdb.ref(`playback/${serverId}`);
    return onValue(ref, (snapshot) => {
      const state = snapshot.val();
      if (!state || isDJ) return;

      const elapsed = (Date.now() - state.updatedAt) / 1000;
      const target = state.position + elapsed;

      playerRef.current?.seekTo(target);
      state.playing
        ? playerRef.current?.play()
        : playerRef.current?.pause();
    });
  }, [serverId, isDJ]);

  const writeState = (patch: Partial<PlaybackState>) => {
    if (!isDJ) return;
    rtdb.ref(`playback/${serverId}`).update({
      ...patch,
      updatedAt: serverTimestamp(),
      djId: currentUser.uid,
    });
  };

  return { playerRef, writeState };
}
```

### Fractional Indexing for Queue Order
Use a simple midpoint strategy. When inserting between two items with `order` values `a` and `b`, set `order = (a + b) / 2`. Start items at `1000`, `2000`, `3000` etc. to leave room. Rebalance (reassign all orders as multiples of 1000) if any gap falls below `0.001`.

### Color Thief Integration
```ts
// useColorThief.ts
import ColorThief from 'colorthief';

export function useColorThief(thumbnailUrl: string | null) {
  useEffect(() => {
    if (!thumbnailUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = thumbnailUrl;
    img.onload = () => {
      const [r, g, b] = new ColorThief().getColor(img);
      document.documentElement.style.setProperty(
        '--accent', `rgb(${r}, ${g}, ${b})`
      );
    };
  }, [thumbnailUrl]);
}
```

---

*Generated for use with Claude Code. Start implementation from Phase 1 and work sequentially. Each phase is independently deployable.*
