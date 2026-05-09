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
