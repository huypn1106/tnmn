import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { useServers } from '../servers/useServers';
import { sharePlaylist } from './playlistActions';
import type { Playlist } from './types';

export default function SharePlaylistModal({
  sourceServerId,
  playlist,
  isOpen,
  onClose,
}: {
  sourceServerId: string;
  playlist: Playlist;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { servers, loading: serversLoading } = useServers();
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedServerIds([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  // The user can share the playlist to any server they have access to.
  const eligibleServers = servers.filter((s) => s.id !== sourceServerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServerIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await sharePlaylist(sourceServerId, playlist.id, selectedServerIds, user.uid, playlist.name);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to share playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleServer = (id: string) => {
    setSelectedServerIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-1/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-bg-2 border border-rule shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="font-serif text-xl font-bold text-text mb-1">Share Playlist</h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-3 mb-6">
            Share "{playlist.name}" to other servers
          </p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
              {serversLoading ? (
                <div className="text-center py-4 text-text-3 font-mono text-[10px] uppercase">
                  Loading servers...
                </div>
              ) : eligibleServers.length === 0 ? (
                <div className="text-center py-4 text-text-3 font-mono text-[10px] uppercase border border-dashed border-rule rounded-xl">
                  No other servers where you are a DJ
                </div>
              ) : (
                eligibleServers.map((server) => (
                  <label 
                    key={server.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-rule hover:bg-bg-3 cursor-pointer transition-colors"
                  >
                    <input 
                      type="checkbox"
                      checked={selectedServerIds.includes(server.id)}
                      onChange={() => toggleServer(server.id)}
                      className="w-4 h-4 rounded border-rule bg-bg-1 text-accent focus:ring-accent focus:ring-offset-bg-2"
                    />
                    <div className="w-8 h-8 rounded-md bg-bg-3 overflow-hidden shrink-0">
                      {server.coverURL ? (
                        <img src={server.coverURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif text-sm text-text-3">
                          {server.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-sans text-sm font-medium text-text truncate">
                      {server.name}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-text-3 hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedServerIds.length === 0}
                className="px-6 py-2 bg-accent text-accent-foreground font-mono text-[10px] uppercase tracking-wider rounded-full hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
