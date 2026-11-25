import type { TranslationRequest, TranslationResult } from './types';

export async function requestTranslation(input: TranslationRequest, signal: AbortSignal): Promise<TranslationResult> {
  const response = await fetch('/api/translation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const payload: Partial<TranslationResult> & { error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.translation !== 'string') {
    throw new Error(payload.error || 'Não foi possível traduzir. Tente novamente.');
  }
  return { translation: payload.translation };
}
