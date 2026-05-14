import { useState, useEffect } from 'react';
import { quotes } from './utils/quotes';

interface QuoteDisplayProps {
  className?: string;
}

export default function QuoteDisplay({ className = '' }: QuoteDisplayProps) {
  const [quote, setQuote] = useState('');

  const [fade, setFade] = useState(true);

  useEffect(() => {
    const changeQuote = () => {
      setFade(false); // start fade out
      setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        setQuote(quotes[randomIndex]);
        setFade(true); // start fade in
      }, 500); // Wait for fade out to complete
    };

    changeQuote(); // initial
    const interval = setInterval(changeQuote, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!quote) return null;

  return (
    <div className={`relative group ${className}`}>
      {/* Animated glow effect behind the text */}
      <div className="absolute -inset-1 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />
      
      {/* Quote text */}
      <p className={`relative font-mono text-[11px] italic text-text-3 opacity-80 group-hover:opacity-100 group-hover:text-accent transition-all duration-500 ease-in-out ${fade ? 'opacity-80 scale-100 blur-none' : 'opacity-0 scale-95 blur-sm'}`}>
        "{quote}"
      </p>
    </div>
  );
}
