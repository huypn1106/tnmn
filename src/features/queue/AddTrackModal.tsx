import { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';
import { fetchTrackMetadata } from './metadata';

export default function AddTrackModal({ serverId, isOpen, onClose }: { serverId: string; isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !url.trim()) return;

    setLoading(true);
    setError('');
    try {
      const meta = await fetchTrackMetadata(url.trim());
      
      // Get current last order
      const q = query(collection(db, 'servers', serverId, 'queue'), orderBy('order', 'desc'), limit(1));
      const snap = await getDocs(q);
      const lastOrder = snap.empty ? 0 : snap.docs[0].data().order;

      await addDoc(collection(db, 'servers', serverId, 'queue'), {
        ...meta,
        addedBy: user.uid,
        addedByName: user.displayName || 'Anonymous',
        order: lastOrder + 1000,
        addedAt: serverTimestamp(),
      });

      onClose();
      setUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to add track');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg border border-rule bg-bg-2 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-3xl italic">Add Track</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-3 italic">YT or SC URL</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
            />
            {error && <p className="font-mono text-[10px] uppercase text-accent mt-1">{error}</p>}
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 font-mono text-xs uppercase tracking-widest hover:bg-bg-3"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex-1 bg-accent py-3 font-mono text-xs uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Fetching...' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
