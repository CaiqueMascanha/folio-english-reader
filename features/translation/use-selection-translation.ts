'use client';

import { useEffect, useMemo, useState } from 'react';
import { requestTranslation } from './client';
import type { PassageAnchor, TranslationRequest } from './types';

export type TranslationSuggestion =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string };

type Excerpt = { text: string; anchor?: PassageAnchor };
type Answer = { request: TranslationRequest; attempt: number; suggestion: TranslationSuggestion };

export function useSelectionTranslation(bookId: string, chapter: number, excerpt: Excerpt | null) {
  const text = excerpt?.text.trim() ?? '';
  const anchor = excerpt?.anchor?.text === text ? excerpt.anchor : undefined;
  const before = anchor?.before;
  const after = anchor?.after;
  const request = useMemo<TranslationRequest | null>(() => {
    if (!text || text.length > 500) return null;
    const anchor = before !== undefined && after !== undefined ? { text, before, after } : undefined;
    return { bookId, chapter, text, anchor };
  }, [bookId, chapter, text, before, after]);

  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    // Native selection handles and keyboard selection can emit several changes per gesture.
    const timer = window.setTimeout(async () => {
      try {
        const { translation } = await requestTranslation(request, controller.signal);
        if (!controller.signal.aborted) setAnswer({ request, attempt, suggestion: { status: 'ready', text: translation } });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Não foi possível sugerir uma tradução.';
        setAnswer({ request, attempt, suggestion: { status: 'error', message } });
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [request, attempt]);

  const suggestion: TranslationSuggestion = answer?.request === request && answer.attempt === attempt
    ? answer.suggestion : { status: request ? 'loading' : 'idle' };
  return { suggestion, retry: () => setAttempt((previous) => previous + 1) };
}
