import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from './useChat';
import { useAuth } from '../auth/useAuth';

export default function ChatRail({ onNewMessage }: { onNewMessage?: () => void }) {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const { messages, sendMessage } = useChat(serverId, onNewMessage);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  if (!serverId) {
    return (
      <div className="flex flex-1 flex-col p-4 opacity-20 items-center justify-center text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest italic">Signal Lost</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-rule shrink-0">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-3 italic">Real-time Feed</h3>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
              {msg.userId !== user?.uid && <span className="font-sans text-[10px] font-bold text-text-2">{msg.displayName}</span>}
              <span className="font-mono text-[8px] text-text-3 italic opacity-50">
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </span>
            </div>
            <div className={`max-w-[90%] px-3 py-2 text-xs font-sans leading-relaxed transition-all ${
              msg.userId === user?.uid ? 'bg-accent text-text italic shadow-lg shadow-accent/10' : 'bg-bg-3 text-text-2 border-l border-accent/20'
            }`}>
              {msg.text}
            </div>
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
          className="w-full bg-bg-3 border-none py-3 px-4 font-sans text-xs text-text outline-none focus:ring-1 ring-accent placeholder:opacity-30"
        />
      </form>
    </div>
  );
}
