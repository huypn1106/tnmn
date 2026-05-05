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
        const [r, g, b] = colorThief.getColor(img);
        const color = `rgb(${r}, ${g}, ${b})`;
        const colorDim = `rgba(${r}, ${g}, ${b}, 0.15)`;
        
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-dim', colorDim);
      } catch (e) {
        console.error('ColorThief failed', e);
      }
    };
  }, [imageUrl]);
}
