'use client';

import { useState } from 'react';
import { Languages, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { TranslationSuggestion } from '@/features/translation/use-selection-translation';
import type { VocabularyEntry } from '@/lib/types';

export function VocabularyDialog({ entry, suggestion, onTextChange, retry, close, submit }: {
  entry: Pick<VocabularyEntry, 'text' | 'context'>;
  suggestion: TranslationSuggestion;
  onTextChange: (text: string) => void;
  retry: () => void;
  close: () => void;
  submit: (entry: Pick<VocabularyEntry, 'text' | 'meaning' | 'context'>) => Promise<void>;
}) {
  const [editedMeaning, setEditedMeaning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const meaning = editedMeaning ?? (suggestion.status === 'ready' ? suggestion.text : '');

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }}>
    <DialogContent><form className="modal-body vocab-form" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !entry.text.trim()) return;
      setBusy(true);
      setError('');
      try { await submit({ ...entry, meaning }); close(); }
      catch { setError('Não foi possível salvar. Tente novamente.'); }
      finally { setBusy(false); }
    }}>
      <button type="button" className="icon-button modal-close" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button>
      <DialogTitle>Salvar vocabulário</DialogTitle>
      <DialogDescription>Adicione o significado agora ou complete depois no seu vocabulário.</DialogDescription>
      <label className="source-field">Palavra ou frase em inglês<textarea required maxLength={500} value={entry.text}
        readOnly={busy} onChange={(event) => onTextChange(event.target.value)} /></label>
      <label className="source-field">Significado ou tradução (opcional)<textarea maxLength={1000} value={meaning}
        placeholder={suggestion.status === 'loading' ? 'Sugerindo tradução…' : undefined}
        readOnly={busy} onChange={(event) => setEditedMeaning(event.target.value)} /></label>
      {suggestion.status === 'error' && <p role="alert" className="form-error">{suggestion.message}</p>}
      {(suggestion.status === 'error' || editedMeaning !== null) && <div className="vocab-edit">
        <Button type="button" variant="outline" disabled={busy || !entry.text.trim()} onClick={() => {
          setEditedMeaning(null);
          if (suggestion.status === 'error') retry();
        }}><Languages size={17} />Sugerir tradução com IA</Button>
      </div>}
      {entry.context && <p className="vocab-context">{entry.context}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button type="submit" disabled={busy || !entry.text.trim()}>{busy ? 'Salvando…' : 'Salvar'}</Button>
    </form></DialogContent>
  </Dialog>;
}
