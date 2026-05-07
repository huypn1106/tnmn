import { useState } from 'react';
import { useAuth } from './useAuth';
import { db } from '../../app/firebase';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

export default function UsernameSetup() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
    setError('');

    try {
      // Check uniqueness
      const q = query(collection(db, 'users'), where('username', '==', val));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('Username is already taken');
        setLoading(false);
        return;
      }

      // Create profile
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName,
        photoURL: user.photoURL,
        username: val,
        friends: [],
        friendRequests: [],
        createdAt: serverTimestamp(),
      });

      // Reload page to refresh ProtectedRoute state or navigate
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      setError('Failed to save username. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="font-serif text-3xl text-text">Choose your handle</h2>
          <p className="font-mono text-xs uppercase tracking-widest text-text-3">
            This is how your friends will find you
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-lg text-text outline-none transition-colors focus:border-accent"
              autoFocus
            />
            {error && <p className="font-mono text-[10px] uppercase text-accent mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !username}
            className="w-full border border-rule bg-bg-2 py-3 font-sans font-medium transition-all hover:bg-bg-3 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
