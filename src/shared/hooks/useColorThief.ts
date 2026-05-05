import { useEffect } from 'react';
// ColorThief is loaded via CDN in index.html

export function useColorThief(imageUrl: string | undefined) {
  useEffect(() => {
    if (!imageUrl) {
      // Reset to default accent
      document.documentElement.style.setProperty('--accent', '#c44b2b');
      document.documentElement.style.setProperty('--accent-dim', 'rgba(196, 75, 43, 0.15)');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const colorThief = new (window as any).ColorThief();
        let [r, g, b] = colorThief.getColor(img);
        
        // Ensure contrast for dark theme (boost brightness if too low)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        if (luminance < 70) {
          const boost = 70 / (luminance || 1);
          r = Math.min(255, Math.floor(r * boost));
          g = Math.min(255, Math.floor(g * boost));
          b = Math.min(255, Math.floor(b * boost));
        }

        const color = `rgb(${r}, ${g}, ${b})`;
        const colorDim = `rgba(${r}, ${g}, ${b}, 0.15)`;
        
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        document.documentElement.style.setProperty('--accent-dim', colorDim);
      } catch (e) {
        console.error('ColorThief failed', e);
      }
    };
  }, [imageUrl]);
}
