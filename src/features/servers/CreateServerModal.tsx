import { useState } from 'react';
import { nanoid } from 'nanoid';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export default function CreateServerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [coverURL, setCoverURL] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    try {
      const serverData = {
        name: name.trim(),
        coverURL: coverURL.trim() || null,
        ownerId: user.uid,
        members: [user.uid],
        roles: { [user.uid]: 'dj' },
        inviteToken: nanoid(10),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'servers'), serverData);
      onClose();
      setName('');
      setCoverURL('');
    } catch (error) {
      console.error("Error creating server:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-rule bg-bg-2 p-8 shadow-2xl">
        <h2 className="mb-6 font-serif text-3xl italic">New Server</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-serif text-xl outline-none transition-colors focus:border-accent"
              placeholder="The Vibe"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Cover URL (Optional)</label>
            <input
              type="url"
              value={coverURL}
              onChange={(e) => setCoverURL(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              placeholder="https://images.com/art.jpg"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 font-mono text-xs uppercase tracking-widest hover:bg-bg-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-accent py-3 font-mono text-xs uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
