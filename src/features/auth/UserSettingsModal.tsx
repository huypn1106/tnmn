import { useState } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../app/firebase';
import { useAuth } from './useAuth';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = username.toLowerCase().trim();
    if (val.length < 3 || val.length > 20) {
      setError('Username must be between 3 and 20 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(val)) {
      setError('Only letters, numbers, and underscores allowed');
      return;
    }

    setLoading(true);
    try {
      // Check uniqueness if username changed
      if (val !== profile?.username) {
        const q = query(collection(db, 'users'), where('username', '==', val));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setError('Username is already taken');
          setLoading(false);
          return;
        }
      }

      // Update Firestore profile
      await updateDoc(doc(db, 'users', user.uid), {
        username: val,
        photoURL: photoURL.trim(),
      });

      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save settings. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/signin';
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Logout failed. Try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-rule bg-bg-2 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-3xl ">User Settings</h2>
          <button onClick={onClose} className="text-text-3 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Username</label>
            <div className="flex items-center gap-2 border-b border-rule transition-colors focus-within:border-accent">
              <span className="font-mono text-xs text-text-3">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 bg-transparent py-2 font-mono text-sm outline-none"
                placeholder="username"
              />
            </div>
            <p className="font-mono text-[9px] text-text-3">3-20 chars: letters, numbers, underscores.</p>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Avatar URL</label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              placeholder="https://images.com/avatar.jpg"
            />
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-rule bg-bg-3">
                  {photoURL ? (
                    <img src={photoURL} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent/10 text-accent font-bold uppercase">
                      {username.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                   <span className="font-sans text-xs font-bold text-text">Preview</span>
                   <span className="font-mono text-[10px] text-text-3">@{username || 'handle'}</span>
                </div>
             </div>
          </div>

          {error && (
            <p className="font-mono text-[10px] uppercase text-accent animate-pulse">{error}</p>
          )}

          <div className="flex flex-col gap-4 pt-4">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 font-mono text-xs uppercase tracking-widest hover:bg-bg-3 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="flex-1 bg-accent py-3 font-mono text-xs uppercase tracking-widest text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="border-t border-rule pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-3 hover:text-accent transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
