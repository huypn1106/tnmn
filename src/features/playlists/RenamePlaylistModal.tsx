import React, { useState } from 'react';
import { updatePlaylist } from './playlistActions';

interface RenamePlaylistModalProps {
  serverId: string;
  playlistId: string;
  currentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function RenamePlaylistModal({
  serverId,
  playlistId,
  currentName,
  isOpen,
  onClose,
}: RenamePlaylistModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await updatePlaylist(serverId, playlistId, { name: name.trim() });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-bg/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-sm border border-rule bg-bg-2 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="mb-6 font-serif text-3xl tracking-tight">Rename Playlist</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">New Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-serif text-xl outline-none transition-colors focus:border-accent"
              autoFocus
              required
            />
          </div>
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 font-mono text-[10px] uppercase tracking-widest text-text-3 hover:bg-bg-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-accent py-3 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-black/20"
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
