import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import { useFriends } from './useFriends';

export default function FriendSearch() {
  const { user } = useAuth();
  const { friends, sendRequest } = useFriends();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (queryText.length < 3) {
        setResults([]);
        return;
      }

      setSearching(true);
      const q = query(
        collection(db, 'users'),
        where('username', '>=', queryText.toLowerCase()),
        where('username', '<=', queryText.toLowerCase() + '\uf8ff'),
        limit(5)
      );

      const snap = await getDocs(q);
      const docs = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(d => d.uid !== user?.uid && !friends.some(f => f.uid === d.uid));
      
      setResults(docs);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [queryText, user, friends]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search by username..."
          className="w-full bg-bg-3 border-none py-2 px-3 font-mono text-[10px] uppercase tracking-widest text-text outline-none focus:ring-1 ring-accent"
        />
        {searching && <div className="absolute right-3 top-2.5 h-2 w-2 animate-ping rounded-full bg-accent" />}
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <div key={result.uid} className="flex items-center justify-between bg-bg-3/50 p-2 border border-rule/50">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-accent opacity-20" />
              <span className="font-sans text-xs font-medium text-text-2">@{result.username}</span>
            </div>
            {result.friendRequests?.some((r: any) => r.from === user?.uid) ? (
              <span className="font-mono text-[8px] uppercase tracking-tighter text-text-3 ">Request Sent</span>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await sendRequest(result.uid);
                    // Refresh results to show 'Request Sent'
                    setResults(prev => prev.map(r => 
                      r.uid === result.uid 
                        ? { ...r, friendRequests: [...(r.friendRequests || []), { from: user?.uid, status: 'pending' }] }
                        : r
                    ));
                  } catch (err) {
                    console.error("Failed to send friend request:", err);
                    alert("Failed to send request. Check console.");
                  }
                }}
                className="font-mono text-[8px] uppercase tracking-tighter text-accent hover:underline"
              >
                Add Friend
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
