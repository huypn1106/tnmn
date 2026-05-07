import { useState } from 'react';
import { updatePlaylist, deletePlaylist } from './playlistActions';
import type { Playlist } from './types';
import ConfirmModal from '../../shared/ConfirmModal';

export default function PlaylistSettingsModal({ 
  serverId, 
  playlist, 
  isOpen, 
  onClose 
}: { 
  serverId: string; 
  playlist: Playlist; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || '');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePlaylist(serverId, playlist.id, {
        name: name.trim(),
        description: description.trim() || null
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deletePlaylist(serverId, playlist.id);
      onClose();
    } catch (error) {
      console.error(error);
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-rule bg-bg-2 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="mb-6 font-serif text-3xl italic">Playlist Settings</h2>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-serif text-xl outline-none transition-colors focus:border-accent"
              required
              autoFocus
            />
          </div>
          
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent resize-none custom-scrollbar"
              placeholder="Tell a story with this collection..."
            />
          </div>

          <div className="flex flex-col gap-3 pt-4">
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
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full py-3 font-mono text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete Playlist
            </button>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Playlist"
          message={`Are you sure you want to delete "${playlist.name}"? This will remove all tracks and cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText="Delete Forever"
          variant="danger"
          loading={loading}
        />
      )}
    </div>
  );
}
