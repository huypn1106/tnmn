import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useFriends } from './useFriends';

export default function FriendsList() {
  const { friends, requests, respondToRequest } = useFriends();
  const [presence, setPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsubscribes = friends.map(friend => {
      const pRef = ref(rtdb, `presence/${friend.uid}`);
      return onValue(pRef, (snap) => {
        setPresence(prev => ({ ...prev, [friend.uid]: snap.val() }));
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [friends]);

  return (
    <div className="space-y-6">
      {/* Requests */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-accent">Requests ({requests.length})</h3>
          {requests.map((req) => (
            <div key={req.from} className="flex items-center justify-between bg-accent-dim p-2">
              <span className="font-mono text-[9px] uppercase text-text italic">Pending</span>
              <div className="flex gap-2">
                <button onClick={() => respondToRequest(req, true)} className="text-white hover:text-accent transition-colors">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
                <button onClick={() => respondToRequest(req, false)} className="text-text-3 hover:text-white transition-colors">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends */}
      <div className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-3">Friends</h3>
        {friends.length === 0 ? (
          <p className="font-serif text-xs italic text-text-3">"The garden is empty."</p>
        ) : (
          friends.map((friend) => {
            const status = presence[friend.uid];
            const isOnline = status?.online;
            return (
              <div key={friend.uid} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="h-8 w-8 bg-bg-3 overflow-hidden grayscale">
                    {friend.photoURL && <img src={friend.photoURL} alt="" className="h-full w-full object-cover" />}
                  </div>
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-2 bg-accent" />
                  )}
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-sans text-xs font-bold text-text-2 truncate">{friend.username}</span>
                  <span className="font-mono text-[8px] uppercase text-text-3 truncate">
                    {isOnline ? (status.activeServerId ? 'Synchronizing' : 'Online') : 'Stationary'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
