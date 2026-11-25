'use client';

import { ArrowLeft, BookOpen, BookmarkPlus, Check, ChevronLeft, ChevronRight, List, Minus, Moon, Plus, Sun, Type, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from './ui/button';
import { VocabularyDialog } from '@/features/vocabulary/components/vocabulary-dialog';
import { usePageTurn } from '@/features/reader/use-page-turn';
import { useSelectionTranslation } from '@/features/translation/use-selection-translation';
import type { Book, Chapter, ChapterIndex } from '../lib/types';
import { selectedExcerpt, wordAtPoint, type ReaderExcerpt } from '../lib/reader-selection';
import styles from './reader-controls.module.css';

const GAP = 68;
const preferences = 'folio-reader-preferences';
const themes = [{ id: 'paper', name: 'Claro', Icon: Sun }, { id: 'sepia', name: 'Sépia', Icon: BookOpen }, { id: 'night', name: 'Escuro', Icon: Moon }] as const;
type Preferences = { font: number; theme: (typeof themes)[number]['id'] };

export default function Reader({ book, initial, contents }: { book: Book; initial: Chapter; contents: ChapterIndex[] }) {
  const [chapter, setChapter] = useState(initial);
  const [settings, setSettings] = useState<Preferences>({ font: 21, theme: 'sepia' });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [panel, setPanel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [draft, setDraft] = useState<ReaderExcerpt | null>(null);
  const [selection, setSelection] = useState<ReaderExcerpt | null>(null);
  const { suggestion, retry } = useSelectionTranslation(book.id, chapter.number, draft ?? (panel || busy ? null : selection));
  const chapterMarkup = useMemo(() => ({ __html: chapter.html }), [chapter.html]);
  const [finished, setFinished] = useState(book.progress === 1);
  const [display, setDisplay] = useState({ width: 0, total: 1, first: 0, spread: 1 });
  const viewport = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const turnSheet = usePageTurn(sheet);
  const pages = useRef<HTMLElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  const turnedBySwipe = useRef(false);
  const cursor = useRef({ fraction: book.position });
  const queue = useRef(Promise.resolve());
  const fetchLock = useRef(false);
  const bookUrl = `/api/books/${book.id}`;
  const lastChapter = chapter.number === contents.length - 1;
  const onLastSpread = display.first + display.spread >= display.total;
  const readable = display.width > 0;
  const clearSelection = useCallback(() => {
    setSelection(null);
    if (selectedExcerpt(pages.current)) window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferences) ?? 'null') as Preferences | null;
      if (saved && Number.isInteger(saved.font) && saved.font >= 16 && saved.font <= 32 && themes.some((theme) => theme.id === saved.theme)) setSettings(saved);
    } catch {}
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (preferencesLoaded) {
      try { localStorage.setItem(preferences, JSON.stringify(settings)); } catch {}
    }
  }, [preferencesLoaded, settings]);

  useLayoutEffect(() => {
    const view = viewport.current;
    const article = pages.current;
    if (!view || !article) return;
    let mounted = true;
    const recalculate = () => {
      if (!mounted) return;
      const { clientWidth: width, clientHeight: height } = view;
      const spread = width >= 710 ? 2 : 1;
      const pageWidth = spread === 2 ? (width - GAP) / 2 : width;
      if (!pageWidth || !height) return;
      article.style.setProperty('--page-width', `${pageWidth}px`);
      article.style.setProperty('--page-gap', `${GAP}px`);
      article.style.setProperty('--image-height', `${Math.min(300, height * 0.9)}px`);
      const total = Math.max(1, Math.round((article.scrollWidth + GAP) / (pageWidth + GAP)));
      const nearest = Math.round(cursor.current.fraction * (total - 1));
      const first = Math.floor(nearest / spread) * spread;
      setDisplay({ width: pageWidth, total, first, spread });
    };
    const observer = new ResizeObserver(recalculate);
    observer.observe(view);
    article.addEventListener('load', recalculate, true);
    document.fonts?.ready.then(recalculate);
    recalculate();
    return () => { mounted = false; observer.disconnect(); article.removeEventListener('load', recalculate, true); };
  }, [chapter, settings.font]);

  const persist = useCallback((number: number, fraction: number, complete: boolean) => {
    const data = { chapter: number, position: fraction, finished: complete };
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch(bookUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true });
        if (!response.ok) throw new Error();
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    });
    return queue.current;
  }, [bookUrl]);

  useEffect(() => {
    persist(book.chapter, book.position, book.progress === 1);
  }, [book.chapter, book.position, book.progress, persist]);

  const openChapter = useCallback(async (number: number, position = 0) => {
    if (number < 0 || number >= contents.length || fetchLock.current) return;
    clearSelection();
    setPanel('');
    if (number === chapter.number) {
      cursor.current.fraction = position;
      setDisplay((current) => ({ ...current, first: Math.floor(Math.round(position * (current.total - 1)) / current.spread) * current.spread }));
      setFinished(false);
      persist(number, position, false);
      return;
    }
    fetchLock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${bookUrl}/chapters/${number}`);
      if (!response.ok) throw new Error();
      const next: Chapter = await response.json();
      turnSheet(number - chapter.number, () => {
        cursor.current.fraction = position;
        setChapter(next);
        setFinished(false);
      });
      persist(number, position, false);
    } catch {
      setError('Não foi possível abrir o capítulo. Tente novamente.');
    } finally {
      fetchLock.current = false;
      setBusy(false);
    }
  }, [bookUrl, chapter.number, clearSelection, contents.length, persist, turnSheet]);

  const turn = useCallback((direction: -1 | 1) => {
    if (!readable || fetchLock.current) return;
    clearSelection();
    const first = Math.floor(Math.round(cursor.current.fraction * (display.total - 1)) / display.spread) * display.spread;
    const target = first + direction * display.spread;
    if (target < 0) {
      if (chapter.number > 0) openChapter(chapter.number - 1, 1);
    } else if (target >= display.total) {
      if (!lastChapter) openChapter(chapter.number + 1);
      else if (!finished) { setFinished(true); persist(chapter.number, cursor.current.fraction, true); }
    } else {
      const fraction = display.total > 1 ? target / (display.total - 1) : 0;
      cursor.current.fraction = fraction;
      turnSheet(direction, () => {
        setDisplay((current) => ({ ...current, first: target }));
        setFinished(false);
      });
      persist(chapter.number, fraction, false);
    }
  }, [chapter.number, clearSelection, display, finished, lastChapter, openChapter, persist, readable, turnSheet]);

  function startSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    turnedBySwipe.current = false;
    if (event.pointerType !== 'touch') return;
    swipe.current = event.isPrimary && !panel
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }
      : null;
  }

  function endSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId || event.timeStamp - start.time > 650) return;
    if (window.getSelection()?.isCollapsed === false) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (Math.abs(horizontal) >= 45 && Math.abs(horizontal) > Math.abs(vertical) * 1.5) {
      turnedBySwipe.current = true;
      turn(horizontal < 0 ? 1 : -1);
    }
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !draft) { setPanel(''); clearSelection(); }
      const editing = event.target instanceof Element && event.target.closest('input, select, textarea');
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || editing || panel || draft) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [clearSelection, draft, panel, turn]);

  useEffect(() => {
    let dragging = false;
    function capture() {
      if (dragging) return;
      const selected = selectedExcerpt(pages.current);
      if (selected) setSelection(selected);
    }
    function pointerDown(event: PointerEvent) {
      dragging = event.target instanceof Node && !!pages.current?.contains(event.target);
    }
    function pointerEnd() {
      if (!dragging) return;
      dragging = false;
      capture();
    }
    document.addEventListener('pointerdown', pointerDown);
    document.addEventListener('pointerup', pointerEnd);
    document.addEventListener('pointercancel', pointerEnd);
    document.addEventListener('selectionchange', capture);
    return () => {
      document.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('pointerup', pointerEnd);
      document.removeEventListener('pointercancel', pointerEnd);
      document.removeEventListener('selectionchange', capture);
    };
  }, []);

  function openVocabulary() {
    if (fetchLock.current) return;
    const excerpt = selectedExcerpt(pages.current) ?? selection ?? { text: '', context: '' };
    if (excerpt.text.length > 500) return;
    setPanel('');
    setDraft(excerpt);
    clearSelection();
  }

  useEffect(() => {
    if (!savedNotice) return;
    const timeout = setTimeout(() => setSavedNotice(false), 4000);
    return () => clearTimeout(timeout);
  }, [savedNotice]);

  async function goBack(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    await persist(chapter.number, cursor.current.fraction, finished);
    window.location.assign('/');
  }

  const percent = finished ? 100 : Math.min(99, Math.round((chapter.number + cursor.current.fraction) / contents.length * 100));
  const through = Math.min(display.first + display.spread, display.total);

  return <main className={`reader reader-${settings.theme}`}>
    <header className="reader-header">
      <Button asChild variant="ghost" className="reader-back"><a href="/" aria-label="Minha estante" onClick={goBack}><ArrowLeft size={19} /><span>Minha estante</span></a></Button>
      <div className="reader-title"><BookOpen size={16} /><strong>{book.title}</strong></div>
      <div className="reader-tools">
        <Button type="button" variant="ghost" className="reader-tool" aria-label="Adicionar ao vocabulário" title="Adicionar ao vocabulário" onClick={openVocabulary}><BookmarkPlus size={20} /></Button>
        <Button type="button" variant="ghost" className="reader-tool" aria-label="Capítulos" aria-expanded={panel === 'contents'} aria-controls="reader-contents" onClick={() => setPanel(panel === 'contents' ? '' : 'contents')}><List size={20} /><span>Capítulos</span></Button>
        <Button type="button" variant="ghost" className="reader-tool" aria-label="Aparência" aria-expanded={panel === 'style'} aria-controls="reader-appearance" onClick={() => setPanel(panel === 'style' ? '' : 'style')}><Type size={20} /></Button>
      </div>
      {panel === 'contents' && <section className="reader-panel" id="reader-contents" aria-label="Capítulos"><h2>Capítulos</h2>
        {book.format === 'TXT' && contents.length === 1 && contents[0].title === book.title && (
          <p className="txt-chapter-note">O Folio não identificou divisões de capítulo neste TXT. A leitura segue como texto contínuo.</p>
        )}
        <ol>
        {contents.map((item) => <li key={item.number}><button type="button" aria-current={item.number === chapter.number ? 'true' : undefined} onClick={() => openChapter(item.number)}><small>{item.number + 1}</small><span>{item.title}</span>{item.number === chapter.number && <Check size={16} />}</button></li>)}
      </ol></section>}
      {panel === 'style' && <section className="reader-panel" id="reader-appearance" aria-label="Aparência"><h2>Aparência</h2><div className="font-size"><span>Tamanho do texto</span><button type="button" aria-label="Diminuir fonte" disabled={settings.font <= 16} onClick={() => setSettings({ ...settings, font: settings.font - 1 })}><Minus size={17} /></button><strong>{settings.font}</strong><button type="button" aria-label="Aumentar fonte" disabled={settings.font >= 32} onClick={() => setSettings({ ...settings, font: settings.font + 1 })}><Plus size={17} /></button></div><div className="reader-themes">{themes.map(({ id, name, Icon }) => <button key={id} type="button" aria-pressed={settings.theme === id} onClick={() => setSettings({ ...settings, theme: id })}><Icon size={18} />{name}</button>)}</div></section>}
    </header>

    <div className={`reading-area ${display.spread === 2 ? 'reading-spread' : ''}`}>
      <div ref={sheet} className="reading-sheet">
        <div className="sheet-top"><span>{chapter.title}</span><span>{chapter.number + 1} / {contents.length}</span></div>
        <div className="paper-viewport" ref={viewport} aria-busy={busy} onPointerDown={startSwipe}
          onPointerUp={endSwipe} onPointerCancel={() => { swipe.current = null; }} onClick={(event) => {
            if (!turnedBySwipe.current && !busy && !draft && !panel) {
              setSelection(selectedExcerpt(pages.current) ?? wordAtPoint(pages.current, event.clientX, event.clientY));
            }
          }}>
          <article lang="en" ref={pages} className="book-text" style={{ '--reader-font': `${settings.font}px`, transform: `translateX(${-display.first * (display.width + GAP)}px)` } as CSSProperties}
            dangerouslySetInnerHTML={chapterMarkup} />
        </div>
        <div className="sheet-bottom"><span>{display.first + 1}{through > display.first + 1 ? `–${through}` : ''}</span><span>{display.total} {display.total === 1 ? 'página no capítulo' : 'páginas no capítulo'}</span></div>
      </div>
    </div>

    <footer className={styles.footer}>
      {selection && !draft && !panel && <div className={styles.selection} role="group" aria-label="Trecho selecionado">
        <div className={styles.excerpt}>
          <span lang={selection.text.length > 500 ? 'pt-BR' : 'en'}>{selection.text.length > 500 ? 'Selecione até 500 caracteres.' : selection.text}</span>
          <div role="status" aria-label="Sugestão de tradução" className={styles.suggestion}>
            {suggestion.status === 'ready' && suggestion.text}
            {suggestion.status === 'loading' && 'Sugerindo tradução…'}
            {suggestion.status === 'error' && 'Tradução indisponível.'}
          </div>
        </div>
        <Button type="button" onClick={openVocabulary}
          disabled={selection.text.length > 500}><BookmarkPlus size={17} /> Salvar trecho</Button>
        <button className={`icon-button ${styles.dismiss}`} type="button" aria-label="Limpar seleção" onClick={clearSelection}><X size={18} /></button>
      </div>}
      <div className={styles.navigation} role="group" aria-label="Navegação de páginas">
      <Button type="button" variant="ghost" className="reader-turn" aria-label="Página anterior" disabled={busy || (!chapter.number && !display.first)} onClick={() => turn(-1)}><ChevronLeft size={21} /></Button>
      <div className="reader-progress"><div><span>{finished ? 'Leitura concluída' : `Capítulo ${chapter.number + 1} de ${contents.length}`}</span><strong>{percent}%</strong></div><progress aria-label="Progresso de leitura" value={percent} max="100" /></div>
      <Button type="button" variant="ghost" className={`reader-turn ${lastChapter && onLastSpread ? 'reader-finish' : ''}`} aria-label={lastChapter && onLastSpread ? 'Concluir leitura' : 'Próxima página'} disabled={busy || !readable || (finished && lastChapter && onLastSpread)} onClick={() => turn(1)}>{lastChapter && onLastSpread ? <Check size={20} /> : <ChevronRight size={21} />}</Button>
      </div>
    </footer>
    {(error || saveError) && <div className="reader-error" role="alert">{error || 'Não foi possível salvar o progresso.'}</div>}
    {savedNotice && <div className="toast" role="status"><Check size={17} /> Trecho salvo <a href="/vocabulary">Ver vocabulário</a></div>}
    {draft && <VocabularyDialog entry={draft} suggestion={suggestion} retry={retry}
      onTextChange={(text) => setDraft({ ...draft, text })}
      close={() => setDraft(null)} submit={async (entry) => {
      const response = await fetch('/api/vocabulary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...entry, bookId: book.id, chapter: chapter.number }) });
      if (!response.ok) throw new Error();
      clearSelection();
      setSavedNotice(true);
    }} />}
  </main>;
}
