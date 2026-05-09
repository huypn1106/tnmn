const KEY = () => `nvidia_calls_${new Date().toISOString().slice(0, 7)}`;

export function incrementAndCheck(): { allowed: boolean; count: number } {
  const count = parseInt(localStorage.getItem(KEY()) ?? '0', 10) + 1;
  localStorage.setItem(KEY(), String(count));
  return { allowed: count <= 1000, count };
}

export function getUsage(): number {
  return parseInt(localStorage.getItem(KEY()) ?? '0', 10);
}
