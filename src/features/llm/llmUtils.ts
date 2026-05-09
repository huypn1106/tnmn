// Shared LLM types and utilities — all interfaces here use `export type`
// so consumers must use `import type { ... }` for these.

export interface LLMTrack {
  title: string;
  artist: string;
  searchQuery: string;
}

export function safeParseJSON<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?/m, '')
      .replace(/```$/m, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
