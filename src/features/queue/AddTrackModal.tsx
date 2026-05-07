import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import { fetchTrackMetadata, parseYouTubeVideoId, parseSoundCloudUrl } from './metadata';
import type { TrackMetadata } from './metadata';
import { searchYouTube } from './youtubeApi';
import type { YouTubeSearchResult } from './youtubeApi';

import { addTrackToPlaylist } from '../playlists/trackActions';

export default function AddTrackModal({ serverId, playlistId, isOpen, onClose }: { serverId: string; playlistId: string; isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setSearchResults([]);
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
    } catch (err: any) {
      setError(err.message || 'Failed to add track');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim();
    if (!user || !val) return;

    setError('');
    
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

  const handleSelectResult = (result: YouTubeSearchResult) => {
    addTrack({
      source: 'youtube',
      sourceId: result.id,
      title: result.title,
      thumbnail: result.thumbnail,
      duration: 0,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl border border-rule bg-bg-2 p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-3xl italic">Add Track</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-3 italic">URL or Search</p>
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
              {success && <p className="font-mono text-[10px] uppercase text-green-500 mt-1">Track added successfully</p>}
            </div>
            <button
              type="submit"
              disabled={loading || searching || !inputValue.trim()}
              className="h-10 px-6 bg-accent font-mono text-[10px] uppercase tracking-widest text-accent-foreground hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Adding...' : searching ? 'Searching...' : 'Go'}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectResult(result)}
                disabled={loading}
                className="w-full flex gap-4 p-2 text-left hover:bg-white/5 transition-colors group disabled:opacity-50"
              >
                <div className="w-32 aspect-video bg-bg-3 shrink-0 relative overflow-hidden">
                  <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif italic text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: result.title }} />
                  <p className="font-mono text-[10px] text-text-3 mt-1">{result.channelTitle}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 font-mono text-xs uppercase tracking-widest hover:bg-bg-3 border-t border-rule mt-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


