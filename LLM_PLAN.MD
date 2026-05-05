### Phase 6 — LLM Playlist + Track Recommendations (Week 11–12)
 
> Uses the **NVIDIA NIM API** free tier — `meta/llama-3.3-70b-instruct` model.
> Free tier provides 1,000 API credits/month (each request costs 1 credit).
> No credit card required. Sign up at [build.nvidia.com](https://build.nvidia.com).
> API is OpenAI-compatible — uses the same `POST /v1/chat/completions` shape.
 
---
 
#### Step 6.1 — NVIDIA NIM API key + environment setup
 
- Sign up at [build.nvidia.com](https://build.nvidia.com) → API Key → Generate
- Add `VITE_NVIDIA_API_KEY` to `.env.local` and `.env.example`
- Add `VITE_NVIDIA_API_KEY` to Cloudflare Pages environment variables dashboard
- Add `VITE_NVIDIA_API_KEY` to GitHub Actions secrets (for build-time access)
- Create `src/features/llm/nvidia.ts`:
  - Export `NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'`
  - Export `NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct'`
  - Export `nvidiaChat(messages, maxTokens)` — thin wrapper around `fetch` to the NVIDIA endpoint
```ts
// src/features/llm/nvidia.ts
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';
 
export async function nvidiaChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });
  if (!res.ok) throw new Error(`NVIDIA API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}
```
 
> **Security note:** `VITE_*` variables are embedded in the client bundle at build time. For a public app, this exposes the key in the browser. This is acceptable for a personal/small-scale free-tier project. If you later scale, proxy through a Cloudflare Worker instead.
 
**Exit criterion:** `nvidiaChat([{ role: 'user', content: 'Say hello' }])` called from a browser console returns a non-empty string. The response appears within 5 seconds. The NVIDIA dashboard → Usage shows 1 credit consumed. No CORS errors (NVIDIA NIM allows browser requests).
 
---
 
#### Step 6.2 — Prompt engineering: playlist generation
 
- Create `src/features/llm/prompts.ts` with a `buildPlaylistPrompt(userPrompt, count)` function
- The system prompt instructs the model to:
  - Return **only** a JSON array — no markdown fences, no explanation, no preamble
  - Each item: `{ "title": string, "artist": string, "searchQuery": string }`
  - `searchQuery` is optimized for YouTube search (e.g. `"Boards of Canada Roygbiv official"`)
  - Respect the requested `count` (default 10, max 20)
  - Interpret mood, genre, era, activity, or abstract concepts as prompt input
```ts
// src/features/llm/prompts.ts
export function buildPlaylistPrompt(userPrompt: string, count = 10): string {
  return `You are a music curator. The user wants a playlist.
Return ONLY a JSON array with exactly ${count} tracks. No markdown. No explanation. No preamble.
Each item must have: "title" (string), "artist" (string), "searchQuery" (string optimized for YouTube search).
 
User prompt: "${userPrompt}"
 
Rules:
- Interpret mood, genre, era, activity, or abstract themes freely
- Vary the energy arc across the playlist (do not front-load all intense tracks)
- searchQuery should include artist name + track title + "official" or "audio" for better YouTube results
- Return valid JSON only. First character must be [`;
}
 
export function buildRecommendPrompt(queueTitles: string[], count = 5): string {
  const listStr = queueTitles.slice(0, 20).map((t, i) => `${i + 1}. ${t}`).join('\n');
  return `You are a music curator. Analyze this playlist and recommend ${count} tracks that fit its vibe.
Return ONLY a JSON array. No markdown. No explanation. No preamble.
Each item: "title" (string), "artist" (string), "searchQuery" (string for YouTube search).
 
Current playlist:
${listStr}
 
Rules:
- Do not repeat any track already in the playlist
- Match the sonic and emotional character of the existing tracks
- Vary the recommendations — not all from the same artist
- Return valid JSON only. First character must be [`;
}
```
 
**Exit criterion:** `buildPlaylistPrompt("late night driving through a city", 10)` returns a string. When passed to `nvidiaChat`, the response is parseable as `JSON.parse(response)` with no `catch`. The parsed array has exactly 10 items each with `title`, `artist`, `searchQuery` fields. Running it 3 times with the same prompt produces different but contextually consistent results.
 
---
 
#### Step 6.3 — YouTube search resolver
 
Each LLM-suggested track arrives as `{ title, artist, searchQuery }` — not a video ID. A second step resolves each to an actual YouTube video using the YouTube Data API v3 search endpoint.
 
- Create `src/features/llm/resolveTrack.ts`:
  - Call `GET /youtube/v3/search?part=snippet&q={searchQuery}&type=video&maxResults=1&key={VITE_YT_API_KEY}`
  - Returns `{ videoId, title, thumbnail, channelTitle }` for the top result
  - Cost: 100 units per search call. Budget: 10,000 units/day free → supports ~100 search calls/day (enough for ~10 playlist generations of 10 tracks)
  - Cache resolved results in `sessionStorage` keyed by `searchQuery` to avoid re-resolving the same track
```ts
// src/features/llm/resolveTrack.ts
const cache = new Map<string, ResolvedTrack>();
 
export async function resolveTrackToYouTube(
  searchQuery: string
): Promise<ResolvedTrack | null> {
  if (cache.has(searchQuery)) return cache.get(searchQuery)!;
 
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', import.meta.env.VITE_YT_API_KEY);
 
  const res = await fetch(url.toString());
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
 
  const resolved: ResolvedTrack = {
    videoId: item.id.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium.url,
    channelTitle: item.snippet.channelTitle,
  };
  cache.set(searchQuery, resolved);
  return resolved;
}
```
 
**Exit criterion:** `resolveTrackToYouTube("Boards of Canada Roygbiv official")` returns an object with a valid `videoId`. The returned `videoId` loads correctly in the YouTube IFrame player. Calling the function twice with the same query uses the cache (second call returns instantly, no network request — verified in DevTools → Network tab). A nonsense query returns `null` without throwing.
 
---
 
#### Step 6.4 — "Generate playlist" UI
 
- Create `src/features/llm/GeneratePlaylistModal.tsx`:
  - Triggered by an "✦ Generate" button in the queue panel header (styled in `--font-mono`, small caps)
  - Full-height modal, dark background (`--bg-2`)
  - Large serif placeholder text: *"Describe a mood, moment, or world…"*
  - Multiline `<textarea>` — no label, just the placeholder
  - Track count selector: pill buttons `5 · 10 · 15 · 20` (default 10)
  - "Generate" button — disabled while loading
  - Loading state: animated waveform bars + italic serif copy *"Curating your playlist…"*
  - On success: show preview list of generated tracks (title + artist) before adding to queue
  - Two actions at bottom: **"Add to queue"** (appends) and **"Replace queue"** (clears first)
  - Error state: *"The model is thinking. Try again in a moment."* (covers API errors + JSON parse failures)
**Exit criterion:** Typing "late night jazz in a rainy city" and clicking Generate shows a loading state, then a list of 10 tracks within 10 seconds. Each track shows title + artist. Clicking "Add to queue" appends all tracks to Firestore and closes the modal. Clicking "Replace queue" first deletes all existing queue items, then writes the new ones. Closing the modal mid-generation cancels the in-flight request (use `AbortController`). A network failure shows the error state, not a crash.
 
---
 
#### Step 6.5 — Full generation pipeline (LLM → resolve → queue write)
 
Wire together steps 6.2, 6.3, and 6.4 into a single `generatePlaylist(prompt, count)` function:
 
```ts
// src/features/llm/generatePlaylist.ts
export async function generatePlaylist(
  prompt: string,
  count: number,
  signal?: AbortSignal
): Promise<QueueItem[]> {
  // 1. Ask LLM for track suggestions
  const systemPrompt = buildPlaylistPrompt(prompt, count);
  const raw = await nvidiaChat(
    [{ role: 'user', content: systemPrompt }],
    count * 60  // ~60 tokens per track
  );
 
  // 2. Parse JSON — strip accidental fences if model misbehaves
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const suggestions: LLMTrack[] = JSON.parse(cleaned);
 
  // 3. Resolve each suggestion to a YouTube video ID (parallel, with abort support)
  const resolved = await Promise.all(
    suggestions.map(async (s) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const yt = await resolveTrackToYouTube(s.searchQuery);
      if (!yt) return null;
      return {
        source: 'youtube' as const,
        sourceId: yt.videoId,
        title: yt.title,
        thumbnail: yt.thumbnail,
        duration: 0,          // filled in once player loads
        addedBy: currentUser.uid,
        order: 0,             // caller assigns fractional order
        addedAt: Timestamp.now(),
      };
    })
  );
 
  return resolved.filter(Boolean) as QueueItem[];
}
```
 
- In the modal, call `generatePlaylist` with an `AbortController.signal`
- Cancel the controller on modal close
- On success, pass the resolved items to the preview list component
- On "Add to queue": batch-write all items with correct fractional `order` values (last existing order + 1000 increments)
- On "Replace queue": batch-delete existing queue, then batch-write new items — wrap in a Firestore `writeBatch`
**Exit criterion:** End-to-end test — type a prompt, click Generate, click "Add to queue". All tracks appear in the queue panel with correct titles and thumbnails. Clicking a track in the queue plays it via the YouTube player. The Firestore queue subcollection matches the displayed tracks. The full pipeline (LLM call + 10 YouTube searches + Firestore write) completes within 15 seconds on a standard connection.
 
---
 
#### Step 6.6 — "Recommended for this playlist" panel
 
Recommendations run automatically whenever the queue changes (debounced — only re-runs after the queue has been stable for 3 seconds to avoid hammering the API).
 
- Create `src/features/llm/useRecommendations.ts`:
  - Watch the queue via `useQueue()` — extract `title` from each item
  - Debounce 3000ms on queue change
  - If queue is empty → return `[]` immediately, no API call
  - If queue has ≥ 1 track: call `nvidiaChat` with `buildRecommendPrompt(titles, 5)`
  - Parse response → resolve each to YouTube via `resolveTrackToYouTube`
  - Store in local state (not Firestore — these are ephemeral suggestions)
  - Re-run when queue changes (new track added, track removed)
  - Guard: skip re-run if the queue titles are identical to the last run (memoize with a hash)
- Create `src/features/llm/RecommendationsPanel.tsx`:
  - Rendered below the queue list, separated by a rule + label *"Suggested"* in `--font-mono` small caps
  - Shows up to 5 recommended tracks
  - Each item: thumbnail (from YouTube search result), title, artist/channel
  - "+ Add" button on each item → `addDoc` to the server's queue
  - Loading state: 3 placeholder rows with shimmer animation (CSS, no library)
  - Collapsed by default on mobile (expand with a tap)
**Exit criterion:** Add 3 tracks to the queue. Within 5 seconds, 5 recommendation cards appear below the queue. Each recommendation is contextually related to the existing tracks (verified manually — not random results). Clicking "+ Add" on a recommendation appends it to the queue and it appears immediately. Adding that same track triggers a new recommendation cycle (the added track is now in the playlist, so a fresh recommendation runs). With an empty queue, the recommendations panel is hidden entirely. Recommendations do not re-run when the queue order changes (only when tracks are added or removed).
 
---
 
#### Step 6.7 — Credit usage guard + rate limiting
 
The NVIDIA free tier provides 1,000 credits/month. Each `nvidiaChat` call costs 1 credit. Protect against runaway usage.
 
- Track call count in `localStorage` keyed as `nvidia_calls_{YYYY-MM}` (resets each month)
- Before each `nvidiaChat` call: increment counter and check against limit
- Soft limit: at 900 calls, show a subtle banner: *"Approaching AI generation limit for this month"*
- Hard limit: at 1,000 calls, disable "Generate" and recommendations; show: *"AI features paused until next month"*
- For recommendations specifically: skip the call if the user has not interacted with the server in the last 60 seconds (check via `document.visibilityState` and a last-interaction timestamp) — prevents background tabs from consuming credits
```ts
// src/features/llm/creditGuard.ts
const KEY = () => `nvidia_calls_${new Date().toISOString().slice(0, 7)}`;
 
export function incrementAndCheck(): { allowed: boolean; count: number } {
  const count = parseInt(localStorage.getItem(KEY()) ?? '0', 10) + 1;
  localStorage.setItem(KEY(), String(count));
  return { allowed: count <= 1000, count };
}
 
export function getUsage(): number {
  return parseInt(localStorage.getItem(KEY()) ?? '0', 10);
}
```
 
**Exit criterion:** Manually set `localStorage.setItem('nvidia_calls_YYYY-MM', '900')` (with the current month). Reload the app → soft limit banner is visible. Set to `1000` → Generate button is disabled and shows the paused message. Set to `500` → normal operation. The counter increments by exactly 1 per `nvidiaChat` call. The counter resets at the start of a new month (change the key's month to verify).
 
---
 
#### Step 6.8 — LLM UI polish
 
- "✦ Generate" button: uses `--font-mono` small-caps, `--accent` color, a subtle shimmer sweep animation on hover (CSS `background` linear-gradient animation)
- Loading state in the modal: the italic serif *"Curating your playlist…"* line cycles through variants every 2s:
  - *"Curating your playlist…"*
  - *"Consulting the archive…"*
  - *"Finding the right frequency…"*
  - *"Almost there…"*
- Recommendation cards animate in with the same `translateY(8px)` + `opacity` pattern as queue items (Step 5.4)
- Track preview in the GeneratePlaylist modal: tracks slide in one by one with a 40ms stagger as they resolve (not all at once)
- Error message styled in `--font-mono --text-3` italic — understated, not alarming
**Exit criterion:** The loading copy cycles visibly during a generation request (> 2 seconds). Recommendation cards appear with a visible slide-in animation. The Generate button hover effect is visible without any external library. The error state message is visible but not visually louder than the surrounding UI. All animations respect `prefers-reduced-motion`.
 
---
 
### Phase 6 — Updated Repo Structure additions
 
```
src/
└── features/
    └── llm/
        ├── nvidia.ts               # API wrapper (nvidiaChat)
        ├── prompts.ts              # buildPlaylistPrompt, buildRecommendPrompt
        ├── resolveTrack.ts         # YouTube search resolver + session cache
        ├── generatePlaylist.ts     # Full pipeline: LLM → resolve → QueueItem[]
        ├── creditGuard.ts          # localStorage usage counter
        ├── useRecommendations.ts   # Debounced recommendation hook
        ├── GeneratePlaylistModal.tsx
        └── RecommendationsPanel.tsx
```
 
### Phase 6 — NVIDIA NIM Key Notes
 
| Concern | Detail |
|---|---|
| **Free quota** | 1,000 credits/month. Each `chat/completions` call = 1 credit. |
| **Model** | `meta/llama-3.3-70b-instruct` — strong instruction following, good for structured JSON output. |
| **JSON reliability** | Llama 3.3 70B follows JSON-only instructions reliably but not perfectly. Always wrap `JSON.parse` in try/catch; retry once on parse failure with a stricter prompt. |
| **Latency** | ~2–6 seconds per call on NVIDIA NIM free tier. Show a loading state; never block the UI. |
| **CORS** | NVIDIA NIM allows browser-direct requests. No proxy needed for free-tier usage. |
| **YT search cost** | Each track resolution = 100 YT units. 10-track playlist = 1,000 units. Daily free cap = 10,000 units → ~10 full playlist generations/day before hitting YouTube quota. |
| **Key exposure** | `VITE_NVIDIA_API_KEY` is visible in the built JS bundle. Acceptable for personal use. For public deployment at scale, move to a Cloudflare Worker proxy. |
 
---
 
## Key Implementation Notes
 
### NVIDIA NIM — JSON Parse Safety
 
The model sometimes returns a markdown fence even when instructed not to. Always sanitize:
 
```ts
function safeParseJSON<T>(raw: string): T | null {
  try {
    // Strip markdown fences the model may add despite instructions
    const cleaned = raw
      .replace(/^```(?:json)?/m, '')
      .replace(/```$/m, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
```
 
If parsing fails, retry once with an appended `'\n\nRemember: return ONLY the JSON array. No other text.'` to the user message.
 
### Recommendation Debounce + Deduplication
 
```ts
// useRecommendations.ts (simplified)
export function useRecommendations(serverId: string) {
  const { queue } = useQueue(serverId);
  const [recs, setRecs] = useState<ResolvedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const lastTitlesHash = useRef('');
 
  useEffect(() => {
    if (queue.length === 0) { setRecs([]); return; }
 
    const titles = queue.map(q => q.title);
    const hash = titles.join('|');
    if (hash === lastTitlesHash.current) return;  // no change
 
    const timer = setTimeout(async () => {
      lastTitlesHash.current = hash;
      const { allowed } = incrementAndCheck();
      if (!allowed) return;
 
      setLoading(true);
      try {
        const prompt = buildRecommendPrompt(titles, 5);
        const raw = await nvidiaChat([{ role: 'user', content: prompt }], 400);
        const suggestions = safeParseJSON<LLMTrack[]>(raw) ?? [];
        const resolved = await Promise.all(suggestions.map(s => resolveTrackToYouTube(s.searchQuery)));
        setRecs(resolved.filter(Boolean) as ResolvedTrack[]);
      } finally {
        setLoading(false);
      }
    }, 3000);
 
    return () => clearTimeout(timer);
  }, [queue]);
 
  return { recs, loading };
}
```
 
---