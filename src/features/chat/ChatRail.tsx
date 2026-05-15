import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from './useChat';
import { useAuth } from '../auth/useAuth';
import { useServer } from '../servers/useServer';
import { usePlaybackSync } from '../playback/usePlaybackSync';

export default function ChatRail({ onNewMessage }: { onNewMessage?: () => void }) {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const { messages, sendMessage } = useChat(serverId, onNewMessage);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  
  const { server, resolvedId } = useServer(serverId);
  // We just need the state, so we pass null for player and false for isDJ/hasInteracted
  const { playbackState } = usePlaybackSync(resolvedId || undefined, false, null, false);

  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Click outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expandedMsgId && detailRef.current && !detailRef.current.contains(event.target as Node)) {
        setExpandedMsgId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedMsgId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    const currentSong = playbackState ? {
      title: playbackState.title,
      thumbnail: playbackState.thumbnail,
      source: playbackState.source,
      sourceId: playbackState.sourceId
    } : null;

    sendMessage(text, currentSong);
    setText('');
  };

  if (!serverId) {
    return (
      <div className="flex flex-1 flex-col p-4 opacity-20 items-center justify-center text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest ">Signal Lost</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-rule shrink-0">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-3 ">Real-time Feed</h3>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'} group relative`}>
            {/* Username and Time */}
            <div className="flex items-center gap-2 mb-1">
              {msg.userId !== user?.uid && <span className="font-chat text-[10px] font-bold text-text-2">@{msg.username}</span>}
              <span className="font-mono text-[8px] text-text-3 opacity-50">
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </span>
            </div>

            {/* Bubble and Action Button Container */}
            <div className={`flex items-center gap-2 max-w-[95%] ${msg.userId === user?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`px-3 py-2 text-xs font-chat leading-relaxed transition-all ${
                msg.userId === user?.uid ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/10' : 'bg-bg-3 text-text-2 border-l border-accent/20'
              }`}>
                {msg.text}
              </div>

              {/* Info Button - Visible on Hover or when Open */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id);
                }}
                className={`p-1.5 rounded-full transition-all shrink-0 ${
                  expandedMsgId === msg.id 
                    ? 'bg-accent text-accent-foreground opacity-100' 
                    : 'text-text-3 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100'
                }`}
                title="Message Details"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            
            {expandedMsgId === msg.id && (
              <div 
                ref={detailRef}
                className={`absolute z-50 top-full mt-1 ${msg.userId === user?.uid ? 'right-0' : 'left-0'} w-[220px] bg-bg-2 border border-rule shadow-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-200`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-text-3">Broadcast Snapshot</p>
                  <button onClick={() => setExpandedMsgId(null)} className="text-text-3 hover:text-text transition-colors">&times;</button>
                </div>
                
                {msg.playbackState ? (
                  <div className="space-y-3">
                    <div className="aspect-video w-full bg-bg-3 overflow-hidden border border-rule/30">
                      {msg.playbackState.thumbnail ? (
                        <img src={msg.playbackState.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-accent/20 flex items-center justify-center">
                          <svg className="h-6 w-6 text-accent/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-[11px] text-text-2 leading-tight line-clamp-2 mb-1 font-medium">{msg.playbackState.title || 'Untitled Track'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[7px] bg-accent/10 px-1.5 py-0.5 rounded text-accent border border-accent/20 uppercase font-bold">
                          {msg.playbackState.source}
                        </span>
                        <span className="font-mono text-[7px] text-text-3 uppercase tracking-tighter truncate opacity-70">
                          {msg.playbackState.sourceId}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="font-chat text-[10px] italic text-text-3 opacity-60">No track was broadcasting at this moment.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-rule shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="w-full bg-bg-3 border-none py-3 px-4 font-chat text-xs text-text outline-none focus:ring-1 ring-accent placeholder:opacity-30"
        />
      </form>
    </div>
  );
}
