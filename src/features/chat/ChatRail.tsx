import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat, type Message } from './useChat';
import { useAuth } from '../auth/useAuth';
import { useServer } from '../servers/useServer';
import { usePlaybackSync } from '../playback/usePlaybackSync';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';

interface MemberProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
}

export default function ChatRail({ onNewMessage }: { onNewMessage?: () => void }) {
  const { serverId } = useParams<{ serverId: string }>();
  const { user, profile } = useAuth();
  const { messages, sendMessage, loadMore, hasMore } = useChat(serverId);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevMessagesRef = useRef<Message[]>([]);
  
  const { server, resolvedId } = useServer(serverId);
  // We just need the state, so we pass null for player and false for isDJ/hasInteracted
  const { playbackState } = usePlaybackSync(resolvedId || undefined, false, null, false);

  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message['replyTo'] | null>(null);

  // States for @ mentions auto-complete
  const [membersList, setMembersList] = useState<MemberProfile[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch server members' profiles to use for autocompletion and highlight mentions
  useEffect(() => {
    if (!server?.members) {
      setMembersList([]);
      return;
    }

    const fetchMembers = async () => {
      try {
        const profiles = await Promise.all(
          server.members.map(async (uid) => {
            const userSnap = await getDoc(doc(db, 'users', uid));
            const data = userSnap.exists() ? userSnap.data() : null;
            return {
              uid,
              username: data?.username || 'unknown',
              displayName: data?.displayName || 'Unknown',
              photoURL: data?.photoURL || ''
            };
          })
        );
        setMembersList(profiles);
      } catch (err) {
        console.error("Failed to fetch server members for mentions:", err);
      }
    };

    fetchMembers();
  }, [server]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If we are within 100px of the bottom, we consider the user to be "at the bottom"
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      isNearBottomRef.current = isAtBottom;
      if (isAtBottom) {
        setShowNewMessageBanner(false);
      }
    }
  };

  const handleScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      isNearBottomRef.current = true;
      setShowNewMessageBanner(false);
    }
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    loadMore();
  };

  // Adjust scroll position to prevent jumpiness when loading older messages and show new message banner when appropriate
  useEffect(() => {
    if (scrollRef.current) {
      const prevLength = prevMessagesRef.current.length;
      const currLength = messages.length;
      
      if (prevLength > 0 && currLength > 0) {
        const firstOldId = prevMessagesRef.current[0]?.id;
        const firstNewId = messages[0]?.id;
        const lastOldId = prevMessagesRef.current[prevLength - 1]?.id;
        const lastNewId = messages[currLength - 1]?.id;

        let handledScroll = false;

        // 1. Maintain scroll when older messages are loaded at the top
        if (firstOldId !== firstNewId && currLength > prevLength) {
          const container = scrollRef.current;
          const oldScrollHeight = container.scrollHeight;
          const oldScrollTop = container.scrollTop;

          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
            setLoadingMore(false);
          });
          handledScroll = true;
        }

        // 2. Check for new messages at the bottom
        if (lastOldId !== lastNewId) {
          if (isNearBottomRef.current) {
            if (!handledScroll) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          } else {
            setShowNewMessageBanner(true);
          }
          
          // Trigger the ping sound if the message is from another user
          const lastMsg = messages[currLength - 1];
          if (lastMsg.userId !== user?.uid && onNewMessage) {
            onNewMessage();
          }
        } else if (isNearBottomRef.current && !handledScroll) {
          // 3. Fallback: just an update, ensure we stay at bottom if we already are
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else if (isNearBottomRef.current) {
        // Initial load or transition from 0 to N messages
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessagesRef.current = messages;
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

  // Auto-complete input handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    const selectionStart = e.target.selectionStart ?? 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    
    // Look for the last '@' symbol in the text before the cursor
    const lastAtOffset = textBeforeCursor.lastIndexOf('@');
    if (lastAtOffset !== -1) {
      // Check if there is whitespace or start of line before the '@'
      const charBeforeAt = lastAtOffset > 0 ? textBeforeCursor[lastAtOffset - 1] : ' ';
      const textAfterAt = textBeforeCursor.slice(lastAtOffset + 1);

      // Mentions should start with whitespace before @, and not contain whitespace after @
      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    setMentionSearch(null);
  };

  const selectMember = (username: string) => {
    if (!inputRef.current) return;
    const val = text;
    const selectionStart = inputRef.current.selectionStart ?? 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const textAfterCursor = val.slice(selectionStart);
    const lastAtOffset = textBeforeCursor.lastIndexOf('@');

    if (lastAtOffset !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, lastAtOffset) + `@${username} `;
      setText(newTextBefore + textAfterCursor);
      
      // Keep focus on the input and set cursor position after the completed mention
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = newTextBefore.length;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    }

    setMentionSearch(null);
  };

  const filteredMembers = mentionSearch !== null
    ? membersList.filter(member => 
        member.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        member.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 5) // limit to top 5 matches
    : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSearch !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMember(filteredMembers[selectedMentionIndex].username);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionSearch(null);
      }
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    const currentSong = playbackState ? {
      title: playbackState.title,
      thumbnail: playbackState.thumbnail,
      source: playbackState.source,
      sourceId: playbackState.sourceId
    } : null;

    // Force scroll to bottom when the user sends a message
    handleScrollToBottom();
    sendMessage(text, currentSong, replyingTo);
    setText('');
    setMentionSearch(null);
    setReplyingTo(null);
  };

  // Check if a message mentions the current user
  const isCurrentUserMentioned = (msgText: string) => {
    const myUsername = profile?.username || user?.displayName;
    if (!myUsername) return false;
    const myMention = `@${myUsername.toLowerCase()}`;
    return msgText.toLowerCase().includes(myMention);
  };

  // Render text content and highlight mentions
  const renderMessageContent = (msgText: string) => {
    // Regex matching @username (3-20 chars, letters, numbers, underscores)
    const mentionRegex = /@([a-z0-9_]{3,20})/gi;
    const parts = msgText.split(mentionRegex);
    if (parts.length === 1) return msgText;

    return parts.map((part, i) => {
      // Every odd index in parts is the matched username group
      if (i % 2 === 1) {
        const exists = membersList.some(m => m.username.toLowerCase() === part.toLowerCase());
        if (exists) {
          return (
            <strong key={i} className="font-bold">
              @{part}
            </strong>
          );
        } else {
          return `@${part}`;
        }
      }
      return part;
    });
  };

  if (!serverId) {
    return (
      <div className="flex flex-1 flex-col p-4 opacity-20 items-center justify-center text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest ">Signal Lost</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-rule shrink-0">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-3 ">Real-time Feed</h3>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="py-1 px-3 bg-bg-3 hover:bg-bg-3/80 text-text-3 hover:text-text border border-rule/50 text-[9px] font-mono uppercase tracking-widest transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More Messages'}
            </button>
          </div>
        )}

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
            <div className={`flex flex-col gap-1 max-w-[95%] ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
              {msg.replyTo && (
                <div 
                  className={`flex items-center gap-1.5 text-[10px] text-text-3 mb-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${
                    msg.userId === user?.uid ? 'flex-row-reverse text-right' : 'flex-row text-left'
                  }`}
                  onClick={() => {
                    // Visual cue to scroll to the message or just indicate it
                  }}
                  title={msg.replyTo.text}
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span className="font-bold">@{msg.replyTo.username}</span>
                  <span className="truncate max-w-[150px]">{msg.replyTo.text}</span>
                </div>
              )}
              <div className={`flex items-center gap-2 ${msg.userId === user?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`px-3 py-2 text-xs font-chat leading-relaxed transition-all ${
                  msg.userId === user?.uid 
                    ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/10' 
                    : isCurrentUserMentioned(msg.text)
                      ? 'bg-accent/10 text-text border-l-2 border-accent shadow-lg shadow-accent/5'
                      : 'bg-bg-3 text-text-2 border-l border-accent/20'
                }`}>
                  {renderMessageContent(msg.text)}
                </div>

                {/* Actions Container */}
                <div className={`flex items-center gap-1 transition-opacity ${expandedMsgId === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {/* Reply Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyingTo({ id: msg.id, text: msg.text, username: msg.username });
                      inputRef.current?.focus();
                    }}
                    className="p-1.5 rounded-full text-text-3 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                    title="Reply"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>

                  {/* Info Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id);
                    }}
                    className={`p-1.5 rounded-full transition-all shrink-0 ${
                      expandedMsgId === msg.id 
                        ? 'bg-accent text-accent-foreground' 
                        : 'text-text-3 hover:text-accent hover:bg-accent/10'
                    }`}
                    title="Message Details"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
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

      {/* Floating New Messages Banner */}
      {showNewMessageBanner && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2 text-[10px] font-mono uppercase tracking-widest shadow-lg shadow-accent/25 hover:brightness-110 active:scale-95 transition-all duration-200 border border-white/10"
        >
          <span>New Messages</span>
          <svg className="h-3 w-3 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Autocomplete Dropdown List */}
      {mentionSearch !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-[72px] left-4 right-4 z-30 border border-rule bg-bg-2/95 backdrop-blur-md shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 rounded">
          <div className="px-2 py-1 border-b border-rule/50 flex justify-between items-center">
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-3">Members Directory</span>
            <span className="font-mono text-[7px] text-text-3 opacity-60">Tab / Enter to select</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredMembers.map((member, i) => (
              <button
                key={member.uid}
                type="button"
                onClick={() => selectMember(member.username)}
                className={`w-full flex items-center gap-3 p-2 transition-all font-sans text-xs ${
                  i === selectedMentionIndex 
                    ? 'bg-accent text-accent-foreground font-medium' 
                    : 'text-text-2 hover:bg-bg-3/50'
                }`}
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded border border-rule bg-bg-3 flex items-center justify-center font-bold text-[9px] uppercase">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    member.username.charAt(0)
                  )}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium truncate leading-tight">@{member.username}</span>
                  <span className={`font-mono text-[8px] truncate leading-none mt-0.5 ${
                    i === selectedMentionIndex ? 'text-accent-foreground/75' : 'text-text-3'
                  }`}>
                    {member.displayName}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-bg-3 border-t border-rule flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex flex-col min-w-0 flex-1 mr-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-accent flex items-center gap-1.5">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Replying to @{replyingTo.username}
            </span>
            <span className="font-chat text-[11px] text-text-3 truncate mt-0.5">{replyingTo.text}</span>
          </div>
          <button type="button" onClick={() => setReplyingTo(null)} className="text-text-3 hover:text-text p-1 shrink-0 rounded-full hover:bg-bg-2 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className={`p-4 border-t border-rule shrink-0 ${replyingTo ? 'bg-bg-3/50' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="w-full bg-bg-3 border-none py-3 px-4 font-chat text-xs text-text outline-none focus:ring-1 ring-accent placeholder:opacity-30"
        />
      </form>
    </div>
  );
}
