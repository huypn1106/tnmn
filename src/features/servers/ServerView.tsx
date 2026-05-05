import { useParams } from 'react-router-dom';
import { useQueue } from '../queue/useQueue';
import { useState, useEffect } from 'react';
import AddTrackModal from '../queue/AddTrackModal';
import { usePlaybackSync } from '../playback/usePlaybackSync';
import WaveformBars from '../playback/WaveformBars';

import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db, rtdb } from '../../app/firebase';
import { ref, update } from 'firebase/database';
import { useAuth } from '../auth/useAuth';
import type { Server } from './useServers';
import ServerSettingsModal from './ServerSettingsModal';
import { useServer } from './useServer';

const EMPTY_QUOTES = [
  "The silence is a canvas. Paint it.",
  "Without music, life would be a mistake.",
  "Where words fail, music speaks.",
  "Music in the soul can be heard by the universe.",
];

export default function ServerView() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, resolvedId, loading: serverLoading } = useServer(serverId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const { queue, loading: queueLoading, removeItem } = useQueue(resolvedId || undefined);
  const isDJ = !!user && !!server && server.roles?.[user.uid] === 'dj';
  const isOwner = !!user && !!server && server.ownerId === user.uid;
  const { playbackState } = usePlaybackSync(resolvedId || undefined, isDJ, null);

  const loading = serverLoading || queueLoading;

  const playTrack = (item: any) => {
    if (!isDJ || !resolvedId) return;
    update(ref(rtdb, `playback/${resolvedId}`), {
      trackId: item.id,
      source: item.source,
      sourceId: item.sourceId,
      title: item.title,
      thumbnail: item.thumbnail,
      position: 0,
      playing: true,
      updatedAt: Date.now(),
      djId: user.uid
    });
  };

  const quote = EMPTY_QUOTES[Math.floor(Date.now() / 86400000) % EMPTY_QUOTES.length];

  if (!resolvedId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,var(--bg-2)_0%,transparent_70%)]">
        <div className="max-w-md space-y-6">
          <h1 className="font-serif text-5xl italic text-text opacity-10 animate-pulse">Select a room.</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-3">Your circle is waiting for the signal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-rule p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-3xl italic tracking-tight">{server?.name || 'Queue'}</h2>
            {isOwner && (
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-text-3 transition-colors hover:text-accent"
                title="Server Settings"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/invite/${server?.inviteToken}`;
                  navigator.clipboard.writeText(url);
                  setShowCopied(true);
                  setTimeout(() => setShowCopied(false), 2000);
                }}
                className="text-text-3 transition-colors hover:text-accent"
                title="Copy Invite Link"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              {showCopied && (
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="whitespace-nowrap bg-accent px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white shadow-xl">
                    Link Copied
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-3">
            {server?.slug ? `/server/${server.slug}` : 'Session Dynamics'}
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="group relative border border-rule bg-bg-2 px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-text transition-all hover:bg-bg-3"
        >
          Add Track
          <div className="absolute inset-x-0 -bottom-px h-px bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </header>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {loading ? (
          <div className="animate-pulse space-y-4">
             {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 w-full bg-bg-3 opacity-50" />)}
          </div>
        ) : queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
             <p className="font-serif text-2xl italic text-text-3 mb-4 max-w-sm leading-relaxed">"{quote}"</p>
             <div className="w-12 h-px bg-rule" />
          </div>
        ) : (
          <div className="space-y-12">
            {/* Now Playing Section */}
            {queue.find(item => item.id === playbackState?.trackId) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Now Playing</h3>
                  <div className="h-px flex-1 mx-4 bg-accent/20" />
                </div>
                {queue.filter(item => item.id === playbackState?.trackId).map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => playTrack(item)}
                    className={`group relative flex flex-col md:flex-row items-center gap-8 border border-rule bg-bg-2 p-6 transition-all 
                      ${isDJ ? 'cursor-pointer hover:bg-bg-3' : 'cursor-default'}
                    `}
                  >
                    <div className="relative h-48 w-full md:w-48 shrink-0 bg-bg-3 overflow-hidden shadow-2xl">
                      <img src={item.thumbnail} alt="" className="h-full w-full object-cover animate-in fade-in zoom-in-95 duration-1000" />
                      <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
                        <WaveformBars isPlaying={playbackState?.playing || false} />
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-4 text-center md:text-left overflow-hidden">
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Currently Broadcasting</p>
                        <h4 className="font-serif text-4xl italic tracking-tight text-text leading-tight truncate">{item.title}</h4>
                      </div>
                      <div className="flex items-center justify-center md:justify-start gap-4">
                        <span className="font-mono text-[10px] uppercase px-2 py-1 border border-rule/50 text-text-3">{item.source}</span>
                        {playbackState?.playing && (
                          <span className="flex items-center gap-2 font-mono text-[10px] uppercase text-accent">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                            Live Sync
                          </span>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="absolute top-4 right-4 text-text-3 opacity-0 transition-all hover:text-accent group-hover:opacity-100"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* All Tracks List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-3">All Tracks</h3>
                <div className="h-px flex-1 mx-4 bg-rule" />
              </div>
              
              <div className="flex flex-col space-y-2">
                {queue.map((item) => {
                  const isPlaying = item.id === playbackState?.trackId;
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => playTrack(item)}
                      className={`group relative flex items-center gap-4 border p-3 transition-all
                        ${isPlaying ? 'border-accent/50 bg-bg-3' : 'border-transparent hover:border-rule'}
                        ${isDJ ? 'cursor-pointer hover:bg-bg-3' : 'cursor-default'}
                      `}
                    >
                      <div className="relative aspect-video w-32 bg-bg-3 shrink-0 overflow-hidden">
                        <img src={item.thumbnail} alt="" className={`h-full w-full object-cover transition-all duration-500 group-hover:opacity-100 group-hover:scale-105 ${isPlaying ? 'opacity-100' : 'opacity-80'}`} />
                        {isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
                            <WaveformBars isPlaying={playbackState?.playing || false} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className={`truncate font-serif text-lg italic transition-colors group-hover:text-text ${isPlaying ? 'text-accent' : 'text-text-2'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="font-mono text-[10px] uppercase text-text-3">{item.source}</p>
                          {isPlaying && <span className="font-mono text-[10px] uppercase text-accent tracking-widest">• Playing</span>}
                        </div>
                      </div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="mr-4 h-8 w-8 flex items-center justify-center text-text-3 opacity-0 transition-all hover:text-accent group-hover:opacity-100"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <AddTrackModal 
        serverId={resolvedId} 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      {server && (
        <ServerSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          server={server} 
        />
      )}
    </div>
  );
}
