import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { nvidiaChat } from './nvidia';
import { buildPlaylistPrompt } from './prompts';
import { resolveTrackToYouTube } from './resolveTrack';
import type { ResolvedTrack } from './resolveTrack';
import { safeParseJSON } from './llmUtils';
import type { LLMTrack } from './llmUtils';
import { incrementAndCheck, getUsage } from './creditGuard';
import { addMultipleTracksToPlaylist } from '../playlists/trackActions';

const LOADING_COPY = [
  'Curating your playlist…',
  'Consulting the archive…',
  'Finding the right frequency…',
  'Almost there…',
];

const COUNT_OPTIONS = [5, 10, 15, 20];

interface Props {
  serverId: string;
  playlistId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewTrack {
  resolved: ResolvedTrack | null;
  llm: LLMTrack;
}

export default function GeneratePlaylistModal({ serverId, playlistId, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [loadingCopyIndex, setLoadingCopyIndex] = useState(0);
  const [tracks, setTracks] = useState<PreviewTrack[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setTracks([]);
      setSelectedIndices(new Set());
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (loading) {
      copyTimerRef.current = setInterval(() => {
        setLoadingCopyIndex(i => (i + 1) % LOADING_COPY.length);
      }, 2000);
    } else {
      if (copyTimerRef.current) clearInterval(copyTimerRef.current);
      setLoadingCopyIndex(0);
    }
    return () => { if (copyTimerRef.current) clearInterval(copyTimerRef.current); };
  }, [loading]);

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndices(next);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === tracks.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(tracks.map((_, i) => i)));
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !user) return;

    const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
    if (!apiKey) {
      setError('NVIDIA API key is not configured. Add VITE_NVIDIA_API_KEY to your .env.local file.');
      return;
    }

    const { allowed } = incrementAndCheck();
    if (!allowed) {
      setError('AI features paused until next month (limit reached).');
      return;
    }

    setLoading(true);
    setError('');
    setTracks([]);
    setSelectedIndices(new Set());

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let raw = await nvidiaChat([{ role: 'user', content: buildPlaylistPrompt(prompt.trim(), count) }], count * 70);
      let suggestions = safeParseJSON<LLMTrack[]>(raw);

      if (!suggestions) {
        raw = await nvidiaChat([
          { role: 'user', content: buildPlaylistPrompt(prompt.trim(), count) + '\n\nRemember: return ONLY the JSON array. No other text.' }
        ], count * 70);
        suggestions = safeParseJSON<LLMTrack[]>(raw);
      }

      if (!suggestions || !Array.isArray(suggestions)) {
        throw new Error('Failed to parse model response as JSON. The model returned unexpected output.');
      }

      // Resolve tracks one by one, adding to preview as they arrive (staggered)
      const preview: PreviewTrack[] = [];
      for (const s of suggestions) {
        if (controller.signal.aborted) break;
        const resolved = await resolveTrackToYouTube(s.searchQuery);
        const item: PreviewTrack = { llm: s, resolved };
        preview.push(item);
        
        // Auto-select resolved tracks by default
        const newTracks = [...preview];
        setTracks(newTracks);
        if (resolved) {
          setSelectedIndices(prev => new Set(prev).add(newTracks.length - 1));
        }
        
        await new Promise(r => setTimeout(r, 40));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[GeneratePlaylist] Error:', err);
      if (err?.message?.includes('API key') || err?.message?.includes('401')) {
        setError('Invalid or missing NVIDIA API key. Check your VITE_NVIDIA_API_KEY in .env.local.');
      } else if (err?.message?.includes('429') || err?.message?.includes('rate')) {
        setError('NVIDIA rate limit hit. Wait a moment and try again.');
      } else if (err?.message?.includes('parse') || err?.message?.includes('JSON')) {
        setError('The model returned unexpected output. Try again — it usually works on a second attempt.');
      } else if (err?.message?.includes('fetch') || err?.message?.includes('network') || err?.message?.includes('Failed to fetch')) {
        setError('Network error. Check your internet connection and try again.');
      } else {
        setError(`Error: ${err?.message || 'Unknown error. Check the browser console for details.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const batchAdd = async (replace: boolean) => {
    if (!user || tracks.length === 0) return;
    
    const selectedTracks = tracks.filter((_, i) => selectedIndices.has(i));
    if (selectedTracks.length === 0) {
      setError('Please select at least one track to add.');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const resolvedTracks = selectedTracks
        .filter(t => t.resolved)
        .map(t => ({
          source: 'youtube' as const,
          sourceId: t.resolved!.videoId,
          title: t.resolved!.title,
          thumbnail: t.resolved!.thumbnail,
          duration: 0,
        }));

      if (resolvedTracks.length === 0) {
        throw new Error('Could not find any of these tracks on YouTube. Check your VITE_YT_API_KEY.');
      }

      console.log(`[BatchAdd] Adding ${resolvedTracks.length} tracks to ${playlistId}`);
      await addMultipleTracksToPlaylist(serverId, playlistId, resolvedTracks, user.uid, replace);
      handleClose();
    } catch (err: any) {
      console.error('[BatchAdd] Error:', err);
      setError(`Failed to add tracks: ${err?.message || 'Unknown error'}`);
    } finally {
      setAdding(false);
    }
  };

  const usage = getUsage();
  const nearLimit = usage >= 900;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] border border-rule bg-bg-2 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-6 border-b border-rule">
          <div>
            <h2 className="font-serif text-3xl">✦ Generate</h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-text-3 mt-1">AI Playlist · Llama 3.3 70B</p>
          </div>
          <button onClick={handleClose} className="h-8 w-8 flex items-center justify-center text-text-3 hover:text-text transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Credit warning */}
        {nearLimit && (
          <div className="shrink-0 px-6 py-2 bg-accent/10 border-b border-rule font-mono text-[9px] uppercase tracking-widest text-accent">
            {usage >= 1000 ? 'AI features paused until next month' : 'Approaching AI generation limit for this month'}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Prompt */}
            <div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe a mood, moment, or world…"
                rows={3}
                disabled={loading || usage >= 1000}
                className="w-full bg-transparent border-b border-rule font-serif text-lg text-text placeholder:text-text-3/40 outline-none resize-none transition-colors focus:border-accent py-2 disabled:opacity-50"
              />
            </div>

            {/* Count selector and Select All */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-text-3 mr-2">Tracks</span>
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                      count === n
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-rule text-text-3 hover:border-text-3 hover:text-text'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {tracks.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="font-mono text-[9px] uppercase tracking-widest text-accent hover:underline"
                >
                  {selectedIndices.size === tracks.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || adding || !prompt.trim() || usage >= 1000}
              className="generate-btn w-full py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-accent border border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span className="relative z-10">
                {loading ? LOADING_COPY[loadingCopyIndex] : '✦ Generate Playlist'}
              </span>
              {!loading && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}
            </button>

            {/* Loading waveform */}
            {loading && (
              <div className="flex items-center justify-center gap-1 py-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-accent/60 rounded-full animate-waveform"
                    style={{
                      height: '20px',
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.8 + i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="font-mono text-[10px] text-text-3 italic">{error}</p>
            )}

            {/* Track preview */}
            {tracks.length > 0 && (
              <div className="space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-text-3 mb-3">
                  {selectedIndices.size} of {tracks.length} tracks selected
                </div>
                {tracks.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => t.resolved && toggleSelect(i)}
                    className={`flex items-center gap-3 p-2 border transition-colors cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                      selectedIndices.has(i)
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-rule/40 hover:border-rule text-text-3'
                    }`}
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <div className={`w-4 h-4 border flex items-center justify-center transition-colors shrink-0 ${
                      selectedIndices.has(i) ? 'border-accent bg-accent' : 'border-rule group-hover:border-text-3'
                    }`}>
                      {selectedIndices.has(i) && (
                        <svg className="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {t.resolved ? (
                      <img
                        src={t.resolved.thumbnail}
                        alt={t.resolved.title}
                        className="w-10 h-10 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-bg-3 shrink-0 animate-pulse" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-serif text-sm truncate transition-colors ${
                        selectedIndices.has(i) ? 'text-text' : 'text-text-3'
                      }`}>
                        {t.resolved?.title || t.llm.title}
                      </p>
                      <p className="font-mono text-[9px] text-text-3 truncate">
                        {t.llm.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {tracks.length > 0 && (
          <div className="shrink-0 flex gap-2 p-6 border-t border-rule">
            <button
              onClick={() => batchAdd(false)}
              disabled={adding || selectedIndices.size === 0}
              className="flex-1 py-3 font-mono text-[10px] uppercase tracking-widest bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {adding ? 'Adding…' : `Add Selected (${selectedIndices.size})`}
            </button>
            <button
              onClick={() => batchAdd(true)}
              disabled={adding || selectedIndices.size === 0}
              className="flex-1 py-3 font-mono text-[10px] uppercase tracking-widest border border-rule text-text-2 hover:bg-bg-3 hover:text-text disabled:opacity-50 transition-all"
            >
              Replace with Selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
