import { useState } from 'react';
import { createPlaylist } from './playlistActions';
import { useAuth } from '../auth/useAuth';

export default function CreatePlaylistModal({ 
  serverId, 
  isOpen, 
  onClose,
  onCreated
}: { 
  serverId: string; 
  isOpen: boolean; 
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [mode, setMode] = useState<'manual' | 'youtube_import' | 'llm'>('manual');
  const [loading, setLoading] = useState(false);
  const enableAI = import.meta.env.VITE_ENABLE_AI_FEATURE === 'true';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    try {
      const newId = await createPlaylist(serverId, name.trim(), user.uid, mode, mode === 'llm' ? llmPrompt.trim() : null);
      
      // If mode is youtube_import, we would handle the import here.
      // But for now, we'll just create the empty playlist.
      // Full YouTube import requires the playlist items API, which would be added in a separate file.

      setName('');
      setDescription('');
      setLlmPrompt('');
      onClose();
      if (onCreated) onCreated(newId);
    } catch (error) {
      console.error("Error creating playlist:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border border-rule bg-bg-2 p-8 shadow-2xl">
        <h2 className="mb-6 font-serif text-3xl ">New Playlist</h2>
        
        <div className="flex gap-2 mb-6 border-b border-rule pb-4">
          <button 
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === 'manual' ? 'bg-bg-3 text-accent' : 'text-text-3 hover:text-text'}`}
          >
            Empty
          </button>
          <button 
            type="button"
            onClick={() => setMode('youtube_import')}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === 'youtube_import' ? 'bg-bg-3 text-accent' : 'text-text-3 hover:text-text'}`}
          >
            From YouTube
          </button>
          {enableAI && (
            <button 
              type="button"
              onClick={() => setMode('llm')}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === 'llm' ? 'bg-bg-3 text-accent' : 'text-text-3 hover:text-text'}`}
            >
              Generate
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-serif text-xl outline-none transition-colors focus:border-accent"
              placeholder="Midnight Drive"
              required
              autoFocus
            />
          </div>
          
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              placeholder="Late night vibes..."
            />
          </div>

          {mode === 'llm' && (
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-text-3">Prompt for AI</label>
              <textarea
                value={llmPrompt}
                onChange={(e) => setLlmPrompt(e.target.value)}
                className="w-full border-b border-rule bg-transparent py-2 font-mono text-sm outline-none transition-colors focus:border-accent resize-none h-20"
                placeholder="A playlist for coding late at night with chill vibes..."
                required
              />
            </div>
          )}

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
              className="flex-1 bg-accent py-3 font-mono text-xs uppercase tracking-widest text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
