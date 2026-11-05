import { useEffect } from 'react';

function createBadgeSvg(count: number): string {
  const label = count > 99 ? '99+' : count.toString();

  let badgeElement = '';
  if (label.length === 1) {
    badgeElement = `<circle cx="22" cy="10" r="9.5" fill="#dc2626" stroke="#0f0e0c" stroke-width="1.8"/>
       <text x="22" y="10.5" fill="#ffffff" stroke="none" font-size="13" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  } else if (label.length === 2) {
    badgeElement = `<rect x="7" y="1" width="24" height="18" rx="9" fill="#dc2626" stroke="#0f0e0c" stroke-width="1.8"/>
       <text x="19" y="10.5" fill="#ffffff" stroke="none" font-size="11.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  } else {
    badgeElement = `<rect x="4" y="1" width="27" height="18" rx="9" fill="#dc2626" stroke="#0f0e0c" stroke-width="1.8"/>
       <text x="17.5" y="10.5" fill="#ffffff" stroke="none" font-size="9.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <g stroke-width="4" stroke-linecap="round">
    <path d="M8 6v20" stroke="#e8e5df"/>
    <path d="M11 6l15 10" stroke="#e8e5df"/>
    <path d="M11 26l15-10" stroke="#c44b2b"/>
  </g>
  ${badgeElement}
</svg>`;
}

export function updateFaviconBadge(count: number) {
  try {
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const newHref = count <= 0
      ? '/favicon.svg'
      : `data:image/svg+xml,${encodeURIComponent(createBadgeSvg(count))}`;

    if (link.getAttribute('href') !== newHref) {
      const newLink = link.cloneNode(true) as HTMLLinkElement;
      newLink.type = 'image/svg+xml';
      newLink.href = newHref;
      link.parentNode?.replaceChild(newLink, link);
    }
  } catch (e) {
    console.warn('Failed to update favicon badge:', e);
  }
}

export function useFaviconBadge(unreadCount: number) {
  useEffect(() => {
    updateFaviconBadge(unreadCount);

    return () => {
      updateFaviconBadge(0);
    };
  }, [unreadCount]);
}
