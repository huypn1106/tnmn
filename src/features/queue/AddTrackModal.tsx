import { useState, useEffect } from 'react';
// ...
import { useAuth } from '../auth/useAuth';
import { fetchTrackMetadata, parseYouTubeVideoId, parseSoundCloudUrl } from './metadata';
import type { TrackMetadata } from './metadata';
import { searchYouTube } from './youtubeApi';
import type { YouTubeSearchResult } from './youtubeApi';
import { nvidiaChat } from '../llm/nvidia';

import { addTrackToPlaylist, addMultipleTracksToPlaylist } from '../playlists/trackActions';

export default function AddTrackModal({ serverId, playlistId, isOpen, onClose }: { serverId: string; playlistId: string; isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const enableAI = import.meta.env.VITE_ENABLE_AI_FEATURE === 'true';

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setSearchResults([]);
      setSelectedTrackIds(new Set());
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const addTrack = async (meta: TrackMetadata) => {
    if (!user || !playlistId) return;
    
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await addTrackToPlaylist(serverId, playlistId, {
        source: meta.source,
        sourceId: meta.sourceId,
        title: meta.title,
        thumbnail: meta.thumbnail,
        duration: meta.duration,
      }, user.uid);

      setSuccess(true);
      setInputValue('');
      setSearchResults([]);
      setSelectedTrackIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to add track');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSelected = async () => {
    if (!user || !playlistId || selectedTrackIds.size === 0) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    const tracksToAdd = searchResults
      .filter(r => selectedTrackIds.has(r.id))
      .map(r => ({
        source: 'youtube' as const,
        sourceId: r.id,
        title: r.title,
        thumbnail: r.thumbnail,
        duration: 0,
      }));

    try {
      await addMultipleTracksToPlaylist(serverId, playlistId, tracksToAdd, user.uid);
      setSuccess(true);
      setInputValue('');
      setSearchResults([]);
      setSelectedTrackIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to add tracks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim();
    if (!user || !val) return;

    setError('');
    setSelectedTrackIds(new Set());
    
    // Check if it's a URL
    const isYT = parseYouTubeVideoId(val);
    const isSC = parseSoundCloudUrl(val);

    if (isYT || isSC) {
      setLoading(true);
      try {
        const meta = await fetchTrackMetadata(val);
        await addTrack(meta);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch track metadata');
        setLoading(false);
      }
    } else {
      // It's a search query
      setSearching(true);
      try {
        const results = await searchYouTube(val);
        setSearchResults(results);
        if (results.length === 0) {
          setError('No results found');
        }
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }
  };

  const handleSuggest = async () => {
    setSearching(true);
    setError('');
    setSelectedTrackIds(new Set());
    try {
      const prompt = `Suggest a good song name and artist to listen to. Return ONLY the title and artist, e.g. "Bohemian Rhapsody by Queen".`;
      const suggestion = await nvidiaChat([{ role: 'user', content: prompt }]);
      setInputValue(suggestion);
      const results = await searchYouTube(suggestion);
      setSearchResults(results);
      if (results.length === 0) {
        setError('No results found for suggestion');
      }
    } catch (err: any) {
      setError(err.message || 'Suggestion failed');
    } finally {
      setSearching(false);
    }
  };

  const handleToggleSelection = (resultId: string) => {
    const next = new Set(selectedTrackIds);
    if (next.has(resultId)) {
      next.delete(resultId);
    } else {
      next.add(resultId);
    }
    setSelectedTrackIds(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl border border-rule bg-bg-2 p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-3xl ">Add Track</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-3 ">URL or Search</p>
        </div>

        <div className="flex flex-col flex-1 min-h-0 space-y-6">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
                placeholder="Paste URL or search keywords..."
                autoFocus
              />
              {error && <p className="font-mono text-[10px] uppercase text-accent mt-1">{error}</p>}
              {success && <p className="font-mono text-[10px] uppercase text-green-500 mt-1">Track{selectedTrackIds.size > 1 ? 's' : ''} added successfully</p>}
            </div>
            {enableAI && (
              <button
                type="button"
                onClick={handleSuggest}
                disabled={loading || searching}
                className="h-10 px-4 bg-bg-3 font-mono text-[10px] uppercase tracking-widest text-text hover:brightness-110 disabled:opacity-50 transition-colors border border-rule hover:border-accent"
              >
                Suggest
              </button>
            )}
            <button
              type="submit"
              disabled={loading || searching || !inputValue.trim()}
              className="h-10 px-6 bg-accent font-mono text-[10px] uppercase tracking-widest text-accent-foreground hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Adding...' : searching ? 'Searching...' : 'Go'}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {searchResults.map((result) => {
              const isSelected = selectedTrackIds.has(result.id);
              return (
                <button
                  key={result.id}
                  onClick={() => handleToggleSelection(result.id)}
                  disabled={loading}
                  className={`w-full flex gap-4 p-2 text-left transition-colors group disabled:opacity-50 border ${
                    isSelected ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="w-32 aspect-video bg-bg-3 shrink-0 relative overflow-hidden">
                    <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                        <div className="bg-accent text-accent-foreground rounded-full p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-serif text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: result.title }} />
                    <p className="font-mono text-[10px] text-text-3 mt-1">{result.channelTitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-4">
            {selectedTrackIds.size > 0 && (
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={loading}
                className="w-full py-3 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Adding...' : `Add ${selectedTrackIds.size} Selected Track${selectedTrackIds.size > 1 ? 's' : ''}`}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 font-mono text-xs uppercase tracking-widest hover:bg-bg-3 border-t border-rule"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


