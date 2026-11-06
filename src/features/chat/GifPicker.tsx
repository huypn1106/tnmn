import { useState, useEffect, useRef } from 'react';
import type { MessageGif } from './useChat';

interface GifPickerProps {
  onSelectGif: (gif: MessageGif) => void;
  onClose: () => void;
}

interface GiphyApiResponseItem {
  id: string;
  title: string;
  images: {
    fixed_height?: {
      url: string;
      width: string;
      height: string;
      webp?: string;
    };
    fixed_width?: {
      url: string;
      width: string;
      height: string;
    };
    downsized_medium?: {
      url: string;
      width: string;
      height: string;
    };
    original?: {
      url: string;
      width: string;
      height: string;
    };
  };
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';

export default function GifPicker({ onSelectGif, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyApiResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Use mousedown with timeout or pointerdown so opening click doesn't trigger close
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [onClose]);

  // Fetch GIFs (Trending or Search) with debounce
  useEffect(() => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API Key chưa được cấu hình');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const trimmedQuery = query.trim();
      const endpoint = trimmedQuery
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(trimmedQuery)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`;

      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`GIPHY API error: ${res.status}`);
        }
        const data = await res.json();
        setGifs(data.data || []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load GIPHY gifs:', err);
          setError('Không thể tải GIF. Vui lòng thử lại.');
        }
      } finally {
        setLoading(false);
      }
    }, query.trim() ? 350 : 0);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const handleSelect = (item: GiphyApiResponseItem) => {
    const mainUrl = item.images.downsized_medium?.url || item.images.fixed_height?.url || item.images.original?.url || '';
    const previewUrl = item.images.fixed_height?.url || item.images.fixed_width?.url || mainUrl;
    const width = Number(item.images.downsized_medium?.width || item.images.fixed_height?.width || 200);
    const height = Number(item.images.downsized_medium?.height || item.images.fixed_height?.height || 200);

    if (!mainUrl) return;

    onSelectGif({
      url: mainUrl,
      previewUrl,
      title: item.title,
      width,
      height,
    });
  };

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-[72px] right-2 left-2 sm:left-auto sm:right-4 sm:w-[360px] h-[390px] bg-bg-2 border border-rule shadow-2xl rounded-lg flex flex-col overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-md"
    >
      {/* Header & Search */}
      <div className="p-2.5 border-b border-rule bg-bg-3/40 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-accent flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6H4zm2 2h3v2H7v4h2v2H6V8zm5 0h2v8h-2V8zm4 0h5v2h-3v1h2v2h-2v3h-2V8z"/>
              </svg>
              GIPHY
            </span>
            <span className="text-[10px] text-text-3 font-mono opacity-60">
              {query.trim() ? 'Search Results' : 'Trending'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-text-3 hover:text-text p-1 rounded transition-colors"
            title="Đóng"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm GIF trên GIPHY..."
            className="w-full bg-bg border border-rule/70 py-1.5 pl-8 pr-7 text-xs font-chat text-text rounded outline-none focus:border-accent transition-colors placeholder:text-text-3/50"
          />
          <svg
            className="h-3.5 w-3.5 text-text-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text p-0.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading && gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-3 space-y-2 py-8">
            <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-[10px] font-mono uppercase tracking-wider">Đang tải GIFs...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs text-red-400 font-mono mb-2">{error}</p>
            <button
              type="button"
              onClick={() => setQuery(query)}
              className="px-2 py-1 bg-bg-3 hover:bg-bg-3/80 text-[10px] font-mono uppercase border border-rule"
            >
              Thử lại
            </button>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-3 text-center p-4">
            <p className="font-mono text-xs">Không tìm thấy GIF phù hợp</p>
            <p className="text-[10px] text-text-3/60 mt-1 font-chat">Hãy thử từ khóa khác</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((item) => {
              const preview = item.images.fixed_height?.url || item.images.fixed_width?.url;
              if (!preview) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="group relative rounded overflow-hidden aspect-[4/3] bg-bg-3 border border-rule/40 hover:border-accent hover:scale-[1.02] active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <img
                    src={preview}
                    alt={item.title || 'GIF'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                    <span className="text-[9px] text-white font-mono truncate drop-shadow">
                      {item.title || 'Send GIF'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - GIPHY Attribution */}
      <div className="px-3 py-1.5 border-t border-rule bg-bg-3/60 flex items-center justify-between shrink-0">
        <span className="font-mono text-[8px] text-text-3 tracking-wider uppercase opacity-75">
          Powered by <strong className="text-accent font-bold">GIPHY</strong>
        </span>
        {loading && gifs.length > 0 && (
          <span className="font-mono text-[8px] text-accent animate-pulse">Updating...</span>
        )}
      </div>
    </div>
  );
}
