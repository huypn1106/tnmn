import { useState } from 'react';
import { usePlaylists } from './usePlaylists';
import CreatePlaylistModal from './CreatePlaylistModal';
import { useAuth } from '../auth/useAuth';
import { setActivePlaylist, deletePlaylist, clonePlaylist, reorderPlaylist, updatePlaylist } from './playlistActions';
import ConfirmModal from '../../shared/ConfirmModal';
import RenamePlaylistModal from './RenamePlaylistModal';
import type { Playlist } from './types';

export default function PlaylistSidebar({ 
  serverId, 
  activePlaylistId, 
  viewedPlaylistId, 
  setViewedPlaylistId,
  isDJ 
}: { 
  serverId: string; 
  activePlaylistId: string | null;
  viewedPlaylistId: string | null;
  setViewedPlaylistId: (id: string) => void;
  isDJ: boolean;
}) {
  const { playlists, loading } = usePlaylists(serverId);
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [playlistToRename, setPlaylistToRename] = useState<Playlist | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);

  // Set initial viewed playlist if not set
  if (!viewedPlaylistId && activePlaylistId && playlists.some(p => p.id === activePlaylistId)) {
    setViewedPlaylistId(activePlaylistId);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-bg-2">
      <div className="shrink-0 p-6 border-t border-rule">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-accent">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">Playlists</h3>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
        {loading ? (
          <div className="space-y-3 px-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-bg-3" />
                <div className="h-3 w-20 rounded bg-bg-3" />
              </div>
            ))}
          </div>
        ) : (
          playlists.map((playlist, index) => {
            const isActive = playlist.id === activePlaylistId;
            const isViewed = playlist.id === viewedPlaylistId;
            
            return (
              <div 
                key={playlist.id}
                onClick={() => setViewedPlaylistId(playlist.id)}
                className={`group relative flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all duration-300 ${
                  isActive 
                    ? 'bg-bg-3 text-white shadow-lg shadow-black/10' 
                    : isViewed 
                      ? 'bg-bg-3/40 text-text' 
                      : 'text-text-2 hover:bg-bg-3/30 hover:text-text'
                }`}
              >
                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute -left-3 h-8 w-1 rounded-r-full bg-accent" />
                )}

                <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border transition-all duration-500 ${
                  isActive ? 'border-accent/40' : 'border-rule grayscale group-hover:grayscale-0'
                }`}>
                  {playlist.coverURL ? (
                    <img src={playlist.coverURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bg-3 font-serif text-lg text-text-3">
                      {playlist.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  {isActive && (
                    <div className="absolute inset-0 bg-accent/20 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="flex items-end gap-[2px] h-3">
                        <div className="w-1 bg-white animate-[waveform_1s_ease-in-out_infinite] h-[40%]" />
                        <div className="w-1 bg-white animate-[waveform_1.2s_ease-in-out_infinite_0.2s] h-[80%]" />
                        <div className="w-1 bg-white animate-[waveform_0.9s_ease-in-out_infinite_0.4s] h-[60%]" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`truncate font-sans text-[13px] font-medium tracking-wide ${isActive ? 'text-white' : 'text-text-2 group-hover:text-text'}`}>
                    {playlist.name}
                  </p>
                  <p className="truncate font-mono text-[9px] uppercase tracking-wider text-text-3 opacity-60">
                    {playlist.trackCount} tracks
                  </p>
                </div>

                <div className={`relative transition-opacity ${isViewed || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === playlist.id ? null : playlist.id);
                    }}
                    className={`p-1.5 rounded-full transition-colors ${isActive ? 'text-white hover:bg-white/10' : 'text-text-3 hover:text-accent hover:bg-accent/10'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {activeMenuId === playlist.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-bg-2 border border-rule shadow-2xl z-50 py-1.5 rounded-lg overflow-hidden ring-1 ring-black/20">
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            const prev = playlists[index - 1];
                            if (prev) {
                              const temp = playlist.order;
                              await reorderPlaylist(serverId, playlist.id, prev.order);
                              await reorderPlaylist(serverId, prev.id, temp);
                            }
                          }}
                          disabled={index === 0}
                          className="flex w-full px-4 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] hover:bg-bg-3 hover:text-accent transition-colors disabled:opacity-20 items-center justify-between"
                        >
                          Move Up <span>↑</span>
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            const next = playlists[index + 1];
                            if (next) {
                              const temp = playlist.order;
                              await reorderPlaylist(serverId, playlist.id, next.order);
                              await reorderPlaylist(serverId, next.id, temp);
                            }
                          }}
                          disabled={index === playlists.length - 1}
                          className="flex w-full px-4 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] hover:bg-bg-3 hover:text-accent transition-colors disabled:opacity-20 items-center justify-between"
                        >
                          Move Down <span>↓</span>
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            setPlaylistToRename(playlist);
                          }}
                          className="w-full px-4 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] hover:bg-bg-3 hover:text-accent transition-colors"
                        >
                          Rename
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            if (!user) return;
                            try {
                              const newId = await clonePlaylist(serverId, playlist.id, user.uid);
                              setViewedPlaylistId(newId);
                            } catch (err: any) {
                              console.error(err);
                            }
                          }}
                          className="w-full px-4 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] hover:bg-bg-3 hover:text-accent transition-colors"
                        >
                          Clone
                        </button>
                        <div className="h-px bg-rule my-1.5" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            setPlaylistToDelete(playlist);
                          }}
                          className="w-full px-4 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 mt-auto">
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="group w-full py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-text-3 hover:text-accent transition-all flex items-center justify-center gap-2 rounded-xl border border-dashed border-rule hover:border-accent/30 hover:bg-accent/5"
        >
          <span className="transition-transform group-hover:scale-125">+</span>
          <span>New Playlist</span>
        </button>
      </div>

      <CreatePlaylistModal 
        serverId={serverId} 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreated={(id) => setViewedPlaylistId(id)}
      />

      {playlistToRename && (
        <RenamePlaylistModal
          serverId={serverId}
          playlistId={playlistToRename.id}
          currentName={playlistToRename.name}
          isOpen={!!playlistToRename}
          onClose={() => setPlaylistToRename(null)}
        />
      )}

      {playlistToDelete && (
        <ConfirmModal
          title="Delete Playlist"
          message={`Are you sure you want to delete "${playlistToDelete.name}"?`}
          onConfirm={() => {
            deletePlaylist(serverId, playlistToDelete.id);
            setPlaylistToDelete(null);
          }}
          onCancel={() => setPlaylistToDelete(null)}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}
