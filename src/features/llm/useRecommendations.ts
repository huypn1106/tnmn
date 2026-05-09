import { useState, useEffect, useRef } from 'react';
import { useTracks } from '../playlists/usePlaylists';
import { incrementAndCheck } from './creditGuard';
import { buildRecommendPrompt } from './prompts';
import { nvidiaChat } from './nvidia';
import { safeParseJSON } from './llmUtils';
import type { LLMTrack } from './llmUtils';
import { resolveTrackToYouTube } from './resolveTrack';
import type { ResolvedTrack } from './resolveTrack';

export function useRecommendations(serverId: string | undefined, playlistId: string | undefined) {
  const { tracks } = useTracks(serverId, playlistId);
  const [recs, setRecs] = useState<ResolvedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const lastTitlesHash = useRef('');

  const fetchRecs = async (force = false) => {
    if (!serverId || !playlistId || tracks.length === 0) return;
    
    const titles = tracks.map(t => t.title);
    const hash = titles.join('|');
    if (!force && hash === lastTitlesHash.current) return;

    if (document.visibilityState !== 'visible' && !force) return;

    lastTitlesHash.current = hash;
    const { allowed } = incrementAndCheck();
    if (!allowed) return;

    setLoading(true);
    try {
      const prompt = buildRecommendPrompt(titles, 3);
      let raw = await nvidiaChat([{ role: 'user', content: prompt }], 300);
      let suggestions = safeParseJSON<LLMTrack[]>(raw);
      if (!suggestions) {
        raw = await nvidiaChat([{ role: 'user', content: prompt + '\n\nRemember: return ONLY the JSON array. No other text.' }], 300);
        suggestions = safeParseJSON<LLMTrack[]>(raw);
      }
      if (!suggestions) suggestions = [];

      const resolved = await Promise.all(
        suggestions.map(s => resolveTrackToYouTube(s.searchQuery))
      );
      setRecs(resolved.filter(Boolean) as ResolvedTrack[]);
    } catch (err) {
      console.error('Failed to generate recommendations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchRecs(), 1000);
    return () => clearTimeout(timer);
  }, [tracks, serverId, playlistId]);

  return { recs, loading, refresh: () => fetchRecs(true) };
}
