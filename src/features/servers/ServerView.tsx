import { useParams } from 'react-router-dom';
import { useQueue } from '../queue/useQueue';
import { useState, useEffect } from 'react';
import AddTrackModal from '../queue/AddTrackModal';

import { doc, onSnapshot } from 'firebase/firestore';
import { db, rtdb } from '../../app/firebase';
import { ref, update } from 'firebase/database';
import { useAuth } from '../auth/useAuth';

const EMPTY_QUOTES = [
  "The silence is a canvas. Paint it.",
  "Without music, life would be a mistake.",
  "Where words fail, music speaks.",
  "Music in the soul can be heard by the universe.",
];

export default function ServerView() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const { queue, loading, removeItem } = useQueue(serverId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [djId, setDjId] = useState<string | null>(null);

  const isDJ = !!user && djId === user.uid;

  useEffect(() => {
    if (!serverId) return;
    const unsubscribe = onSnapshot(doc(db, 'servers', serverId), (doc) => {
      if (doc.exists()) {
        setDjId(doc.data().djId);
      }
    });
    return () => unsubscribe();
  }, [serverId]);

  const playTrack = (item: any) => {
    if (!isDJ || !serverId) return;
    update(ref(rtdb, `playback/${serverId}`), {
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

  if (!serverId) {
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
          <h2 className="font-serif text-3xl italic tracking-tight">Queue</h2>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-3">Session Dynamics</p>
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
          <div className="space-y-1">
            {queue.map((item) => (
              <div 
                key={item.id} 
                onClick={() => playTrack(item)}
                className={`group flex items-center gap-4 border-b border-rule/50 py-3 transition-colors px-2 ${isDJ ? 'cursor-pointer hover:bg-bg-3/50' : 'cursor-default'}`}
              >
                <div className="relative h-10 w-10 shrink-0 bg-bg-3 overflow-hidden">
                   <img src={item.thumbnail} alt="" className="h-full w-full object-cover opacity-80" />
                </div>
                <div className="flex-1 truncate">
                  <p className="truncate font-sans text-sm font-medium text-text-2">{item.title}</p>
                  <p className="font-mono text-[10px] uppercase text-text-3 tracking-tighter">{item.source}</p>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="text-text-3 opacity-0 transition-all hover:text-accent group-hover:opacity-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddTrackModal 
        serverId={serverId} 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
