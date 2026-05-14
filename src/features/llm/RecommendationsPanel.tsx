import { useRecommendations } from './useRecommendations';
import type { ResolvedTrack } from './resolveTrack';
import { useAuth } from '../auth/useAuth';
import { addTrackToPlaylist } from '../playlists/trackActions';

import { useState } from 'react';

interface Props {
  serverId: string;
  playlistId: string;
}

export function RecommendationsPanel({ serverId, playlistId }: Props) {
  const enableAI = import.meta.env.VITE_ENABLE_AI_FEATURE === 'true';
  const { recs, loading, refresh } = useRecommendations(serverId, playlistId);
  const { user } = useAuth();
  const [show, setShow] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  if (!enableAI) return null;

  const handleAdd = async (track: ResolvedTrack) => {
    if (!user) return;
    await addTrackToPlaylist(serverId, playlistId, {
      source: 'youtube',
      sourceId: track.videoId,
      title: track.title,
      thumbnail: track.thumbnail,
      duration: 0,
    }, user.uid);
  };

  return (
    <div className="shrink-0 border-t border-rule px-4 md:px-8 py-3 md:py-4 bg-bg/50 backdrop-blur-sm max-h-[40vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-2 md:mb-3 shrink-0">
        <button 
          onClick={() => setShow(!show)}
          className="flex items-center gap-2 group"
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-text-3 group-hover:text-text transition-colors">Suggested</div>
          <svg 
            className={`w-3 h-3 text-text-3 group-hover:text-text transition-all duration-300 ${show ? 'rotate-0' : '-rotate-90'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <button 
          onClick={refresh}
          disabled={loading || !show}
          className="font-mono text-[9px] uppercase tracking-widest text-text-3 hover:text-accent transition-colors flex items-center gap-1.5 group disabled:opacity-50"
        >
          <svg 
            className={`w-3 h-3 transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {show && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300 overflow-y-auto custom-scrollbar pr-1">
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-bg-3 animate-pulse" />
              ))}
            </>
          ) : recs.length > 0 ? (
            recs.map((track) => (
              <div
                key={track.videoId}
                className="flex items-center gap-3 p-2 border border-rule/30 hover:border-rule transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="w-10 h-10 object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm truncate text-text">{track.title}</p>
                  <p className="font-mono text-[9px] text-text-3 truncate">{track.channelTitle}</p>
                </div>
                <button
                  onClick={() => handleAdd(track)}
                  className="shrink-0 px-3 py-1 font-mono text-[9px] uppercase tracking-widest border border-rule text-text-3 hover:border-accent hover:text-accent transition-colors"
                >
                  + Add
                </button>
              </div>
            ))
          ) : (
            <p className="font-mono text-[9px] text-text-3 italic py-4">
              Add more tracks to get vibe-matched suggestions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
