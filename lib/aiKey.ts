// Per-user AI key storage ("bring your own key") for Speaking AI scoring.
//
// Keys live ONLY in this browser's localStorage. They are sent to
// /api/speaking/score with each scoring request and never stored, logged,
// or persisted anywhere server-side.

export type AiProvider = 'openai' | 'gemini';

export const AI_PROVIDER_STORAGE_KEY = 'vstep_ai_provider';
export const AI_KEY_STORAGE_KEY = 'vstep_ai_key';

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
}

/** Default provider is Gemini because its key is free. */
export function getAiSettings(): AiSettings {
  if (typeof window === 'undefined') return { provider: 'gemini', apiKey: '' };
  const raw = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
  const provider: AiProvider = raw === 'openai' ? 'openai' : 'gemini';
  const apiKey = (window.localStorage.getItem(AI_KEY_STORAGE_KEY) || '').trim();
  return { provider, apiKey };
}

export function saveAiSettings(provider: AiProvider, apiKey: string): void {
  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
  window.localStorage.setItem(AI_KEY_STORAGE_KEY, apiKey.trim());
}

export function clearAiSettings(): void {
  window.localStorage.removeItem(AI_PROVIDER_STORAGE_KEY);
  window.localStorage.removeItem(AI_KEY_STORAGE_KEY);
}
