import { nvidiaChat } from './nvidia';
import { buildPlaylistPrompt } from './prompts';
import { resolveTrackToYouTube } from './resolveTrack';
import { incrementAndCheck } from './creditGuard';
import { safeParseJSON } from './llmUtils';
import type { LLMTrack } from './llmUtils';

export interface ResolvedPlaylistTrack {
  source: 'youtube';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;
  addedBy: string;
  order: number;
}

export async function generatePlaylist(
  prompt: string,
  count: number,
  userId: string,
  signal?: AbortSignal
): Promise<ResolvedPlaylistTrack[]> {
  const { allowed } = incrementAndCheck();
  if (!allowed) throw new Error('AI generation limit reached for this month');

  let raw = await nvidiaChat([{ role: 'user', content: buildPlaylistPrompt(prompt, count) }], count * 60);
  let suggestions = safeParseJSON<LLMTrack[]>(raw);

  if (!suggestions) {
    raw = await nvidiaChat([
      { role: 'user', content: buildPlaylistPrompt(prompt, count) + '\n\nRemember: return ONLY the JSON array. No other text.' }
    ], count * 60);
    suggestions = safeParseJSON<LLMTrack[]>(raw);
  }

  if (!suggestions || !Array.isArray(suggestions)) {
    throw new Error('Failed to parse AI response');
  }

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
        duration: 0,
        addedBy: userId,
        order: 0,
      };
    })
  );

  return resolved.filter(Boolean) as ResolvedPlaylistTrack[];
}
