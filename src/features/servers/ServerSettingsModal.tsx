import { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Server } from './useServers';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server;
}

export default function ServerSettingsModal({ isOpen, onClose, server }: ServerSettingsModalProps) {
  const [name, setName] = useState(server.name);
  const [slug, setSlug] = useState(server.slug || '');
  const [coverURL, setCoverURL] = useState(server.coverURL || '');
  const [roles, setRoles] = useState(server.roles || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [members, setMembers] = useState<{ uid: string; displayName: string }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setName(server.name);
    setSlug(server.slug || '');
    setCoverURL(server.coverURL || '');
    setRoles(server.roles || {});
    setError(null);
    setShowDeleteConfirm(false);

    if (isOpen) {
      // Fetch member profiles for DJ selection
      const fetchMembers = async () => {
        const profiles = await Promise.all(
          server.members.map(async (uid) => {
            const snap = await getDoc(doc(db, 'users', uid));
            return { uid, displayName: snap.exists() ? snap.data().displayName : 'Unknown' };
          })
        );
        setMembers(profiles);
      };
      fetchMembers();
    }
  }, [server, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formattedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    if (formattedSlug && formattedSlug.length < 3) {
      setError('Slug must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      // Check if slug is taken
      if (formattedSlug && formattedSlug !== server.slug) {
        const q = query(collection(db, 'servers'), where('slug', '==', formattedSlug));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setError('This URL is already taken');
          setLoading(false);
          return;
        }
      }

      await updateDoc(doc(db, 'servers', server.id), {
        name: name.trim(),
        slug: formattedSlug || null,
        coverURL: coverURL.trim() || null,
        roles,
      });
      
      onClose();
    } catch (error) {
      console.error("Error updating server:", error);
      setError('Failed to update server settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-rule bg-bg-2 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-3xl ">Server Settings</h2>
          <button onClick={onClose} className="text-text-3 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
            />
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Custom URL (Slug)</label>
            <div className="flex items-center gap-2 border-b border-rule transition-colors focus-within:border-accent">
              <span className="font-mono text-xs text-text-3">/server/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="flex-1 bg-transparent py-2 font-mono text-sm outline-none"
                placeholder="my-cool-room"
              />
            </div>
            <p className="font-mono text-[9px] text-text-3">Lowercase, numbers, and hyphens only.</p>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Cover URL</label>
            <input
              type="url"
              value={coverURL}
              onChange={(e) => setCoverURL(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              placeholder="https://images.com/art.jpg"
            />
          </div>

          <div className="space-y-3">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Member Permissions</label>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-rule/50 p-3 bg-bg-3/30 custom-scrollbar">
              {members.map((m) => (
                <div key={m.uid} className="flex items-center justify-between gap-4 py-1">
                  <span className="truncate font-sans text-xs text-text-2">{m.displayName}</span>
                  <select
                    value={roles[m.uid] || 'guest'}
                    onChange={(e) => setRoles({ ...roles, [m.uid]: e.target.value as 'dj' | 'guest' })}
                    disabled={m.uid === server.ownerId}
                    className="bg-bg-2 border-b border-rule font-mono text-[9px] uppercase outline-none focus:border-accent disabled:opacity-50"
                  >
                    <option value="guest">Guest</option>
                    <option value="dj">DJ</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Invite Token</label>
            <div className="flex items-center gap-2 border-b border-rule transition-colors focus-within:border-accent">
              <input
                type="text"
                value={server.inviteToken}
                readOnly
                className="flex-1 bg-transparent py-2 font-mono text-sm outline-none opacity-50"
              />
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Regenerate invite token? Existing links will break.')) {
                    await updateDoc(doc(db, 'servers', server.id), {
                      inviteToken: nanoid(10)
                    });
                  }
                }}
                className="font-mono text-[8px] uppercase tracking-widest text-accent hover:brightness-110"
              >
                Regenerate
              </button>
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
                disabled={loading || !name.trim()}
                className="flex-1 bg-accent py-3 font-mono text-xs uppercase tracking-widest text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="border-t border-rule pt-4">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-3 hover:text-accent transition-colors"
                >
                  Danger: Delete Server
                </button>
              ) : (
                <div className="space-y-3 bg-bg-3 p-4">
                  <p className="font-mono text-[10px] text-accent uppercase leading-relaxed">
                    This action is irreversible. All messages and the queue will be lost.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 font-mono text-[10px] uppercase bg-bg-2 hover:bg-bg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await deleteDoc(doc(db, 'servers', server.id));
                          onClose();
                          navigate('/');
                        } catch (e) {
                          setError('Failed to delete server');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="flex-1 py-2 font-mono text-[10px] uppercase bg-accent text-accent-foreground"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
