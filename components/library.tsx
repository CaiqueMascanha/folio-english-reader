'use client';

import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronRight, CircleHelp, Ellipsis, ExternalLink, LibraryBig, Plus, Search, Sparkles, UploadCloud, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import BookScene from './book-scene';
import { Cover } from './covers';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import type { Book, ImportResult } from '../lib/types';
import { levels as cefrLevels } from '@/lib/levels';

import { LibrarySidebar, catalogUrl as CATALOG, sections, type LibraryView } from '@/features/library/sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const EXAMPLE = `${CATALOG}book/stephen-hawking-alex-raynham`;

function Modal({ children, close }: { children: ReactNode; close: () => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent><div className="modal-body">{children}</div></DialogContent>
  </Dialog>;
}

function LevelSelect({ value, change, empty, disabled }: { value: string; change: (value: string) => void; empty: string; disabled: boolean }) {
  return <label className="source-field">Nível de inglês
    <select value={value} onChange={(event) => change(event.target.value)} disabled={disabled}>
      <option value="">{empty}</option>
      {cefrLevels.map((level) => <option value={level} key={level}>{level}</option>)}
    </select>
  </label>;
}

function EditLevel({ book, close, updated }: { book: Book; close: () => void; updated: (book: Book) => void }) {
  const [level, setLevel] = useState(book.level || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal close={() => { if (!busy) close(); }}><form className="vocab-form" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/books/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: level || null }) });
      if (!response.ok) throw new Error();
      updated(await response.json());
    } catch { setError('Não foi possível atualizar o nível.'); }
    finally { setBusy(false); }
  }}>
    <DialogTitle>Editar nível</DialogTitle><DialogDescription>{book.title}</DialogDescription>
    <LevelSelect value={level} change={setLevel} empty="Sem nível" disabled={busy} />
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="vocab-edit"><Button type="submit" disabled={busy}>Salvar nível</Button><Button variant="outline" type="button" disabled={busy} onClick={close}>Cancelar</Button></div>
  </form></Modal>;
}

function ImportDialog({ close, imported }: { close: () => void; imported: (results: ImportResult[], close: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [source, setSource] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [level, setLevel] = useState('');
  const [error, setError] = useState('');

  async function upload(files: File[]) {
    if (busy || !files.length) return;
    setBusy(true);
    setError('');
    const errors: string[] = [];
    const results: ImportResult[] = [];
    for (const file of files) {
      try {
        if (!/\.(epub|txt)$/i.test(file.name)) throw new Error('Escolha EPUB ou TXT.');
        if (file.size > 25 * 1024 * 1024) throw new Error('O limite é de 25 MB.');
        const data = new FormData();
        data.set('file', file);
        if (level) data.set('level', level);
        if (files.length === 1 && source.trim()) data.set('source', source.trim());
        const response = await fetch('/api/books', { method: 'POST', body: data });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao importar.');
        results.push(result);
      } catch (failure) {
        errors.push(`${file.name}: ${failure instanceof Error ? failure.message : 'Falha ao importar.'}`);
      }
    }
    setBusy(false);
    if (results.length) imported(results, errors.length === 0);
    if (errors.length) setError(errors.join('\n'));
  }

  return <Modal close={() => { if (!busy) close(); }}>
    <button type="button" className="icon-button modal-close" aria-label="Fechar" onClick={close} disabled={busy}><X size={20} /></button>
    <span className="modal-icon"><UploadCloud size={24} /></span>
    <DialogTitle>Importar livros</DialogTitle>
    <DialogDescription>Adicione os arquivos que você baixou do English e-Reader ou de outra fonte.</DialogDescription>
    <div className="import-level"><LevelSelect value={level} change={setLevel} empty="Detectar automaticamente" disabled={busy} /></div>
    <Input ref={input} type="file" aria-label="Selecionar arquivos EPUB ou TXT" multiple accept=".epub,.txt" hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; upload(files); }} />
    <button type="button" className={`dropzone ${over ? 'drag-over' : ''}`} aria-describedby="txt-import-note" disabled={busy} onClick={() => input.current?.click()}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); upload(Array.from(event.dataTransfer.files)); }}>
      <UploadCloud size={29} /><strong>{busy ? 'Importando…' : 'Arraste ou selecione seus arquivos'}</strong><span>EPUB ou TXT · até 25 MB por arquivo</span>
    </button>
    <p id="txt-import-note" className="txt-import-note">Em arquivos TXT, o Folio procura títulos como “Chapter 1”. Se não encontrar, o livro abre como texto contínuo.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {sourceOpen ? <label className="source-field">Link do livro no catálogo (opcional)
      <Input type="url" placeholder={EXAMPLE} value={source} onChange={(event) => setSource(event.target.value)} disabled={busy} />
      <span>O link é salvo ao importar um arquivo por vez.</span>
    </label> : <button type="button" className="plain-link" onClick={() => setSourceOpen(true)}><Plus size={15} /> Adicionar link do livro</button>}
    <a className="catalog-inline" href={CATALOG} target="_blank" rel="noreferrer">Abrir English e-Reader <ArrowUpRight size={16} /></a>
  </Modal>;
}

function BookCard({ book, toggleFavorite, askDelete, editLevel }: { book: Book; toggleFavorite: (book: Book) => void; askDelete: (book: Book) => void; editLevel: (book: Book) => void }) {
  const percent = Math.round(book.progress * 100);
  return <article className="book-card">
    <Link aria-label={`Ler ${book.title}`} href={`/read/${book.id}`} className="cover-stage">
      <Cover book={book} />
    </Link>
    <button type="button" className={`icon-button card-fav ${book.favorite ? 'is-saved' : ''}`} aria-label={book.favorite ? `Remover ${book.title} dos favoritos` : `Adicionar ${book.title} aos favoritos`} aria-pressed={book.favorite} onClick={() => toggleFavorite(book)}><Bookmark size={17} /></button>
    <div className="book-meta">
      <div className="book-meta-top"><span className={`level-tag ${book.level?.startsWith('A') ? 'level-a' : 'level-b'}`}>{book.level || 'Sem nível'}</span><span className="book-category">{book.format}</span></div>
      <Link className="book-title" href={`/read/${book.id}`} title={book.title}>{book.title}</Link>
      <p title={book.author}>{book.author}</p>
      <details className="book-menu">
        <summary className="icon-button" aria-label={`Opções para ${book.title}`}><Ellipsis size={19} /></summary>
        <div className="popover">
          <button type="button" onClick={(event) => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; editLevel(book); }}>Editar nível</button>
          {book.source && <a href={book.source} target="_blank" rel="noreferrer">Ver no catálogo <ExternalLink size={14} /></a>}
          <button type="button" onClick={(event) => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; askDelete(book); }}>Remover da estante</button>
        </div>
      </details>
      {book.openedAt && <div className="card-progress"><span><i style={{ width: `${percent}%` }} /></span><small>{percent}%</small></div>}
    </div>
  </article>;
}

export default function Library({ initialBooks, sidebarOpen }: { initialBooks: Book[]; sidebarOpen: boolean }) {
  const [books, setBooks] = useState(initialBooks);
  const [view, setView] = useState<LibraryView>('all');
  const [level, setLevel] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [importing, setImporting] = useState(false);
  const [help, setHelp] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [editingLevel, setEditingLevel] = useState<Book | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const counts = { all: books.length, reading: books.filter((book) => book.openedAt && book.progress < 1).length, favorites: books.filter((book) => book.favorite).length };
  const featured = [...books].filter((book) => book.openedAt && book.progress < 1).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))[0] || books[0];
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const scoped = books.filter((book) => view === 'all' || (view === 'reading' ? book.openedAt && book.progress < 1 : book.favorite));
  const levels = [...new Set(scoped.flatMap((book) => book.level ? [book.level] : []))].sort();
  const filtered = scoped.filter((book) => (level === 'all' || book.level === level) && `${book.title} ${book.author}`.toLocaleLowerCase('pt-BR').includes(normalized));
  if (sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));

  function show(next: LibraryView) {
    setView(next);
    setLevel('all');
    setQuery('');
  }

  async function toggleFavorite(book: Book) {
    try {
      const response = await fetch(`/api/books/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: !book.favorite }) });
      if (!response.ok) throw new Error();
      const saved: Book = await response.json();
      setBooks((current) => current.map((item) => item.id === saved.id ? saved : item));
      setToast(saved.favorite ? 'Livro adicionado aos favoritos.' : 'Livro removido dos favoritos.');
    } catch {
      setToast('Não foi possível atualizar os favoritos.');
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/books/${pendingDelete.id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error();
      setBooks((current) => current.filter((book) => book.id !== pendingDelete.id));
      setPendingDelete(null);
      setLevel('all');
      setToast('Livro removido da estante.');
    } catch {
      setToast('Não foi possível remover o livro.');
    } finally {
      setSaving(false);
    }
  }

  function imported(results: ImportResult[], close: boolean) {
    const newBooks = results.filter((result) => !result.duplicate).map((result) => result.book).reverse();
    const byId = new Map(results.map(({ book }) => [book.id, book]));
    const changedLevel = results.some(({ book, duplicate }) => duplicate && books.find((previous) => previous.id === book.id)?.level !== book.level);
    if (newBooks.length || changedLevel) show('all');
    setBooks((current) => {
      const existingIds = new Set(current.map(({ id }) => id));
      return [...newBooks.filter(({ id }) => !existingIds.has(id)).map((book) => byId.get(book.id) ?? book),
        ...current.map((book) => byId.get(book.id) ?? book)];
    });
    if (close) setImporting(false);
    setToast(newBooks.length > 1 ? `${newBooks.length} livros importados.` : newBooks.length ? 'Livro importado para sua estante.' : changedLevel ? 'Nível atualizado.' : 'Este livro já está na sua estante.');
  }

  const label = sections.find((section) => section.id === view)?.label ?? 'Minha estante';

  return <SidebarProvider defaultOpen={sidebarOpen}>
    <LibrarySidebar view={view} counts={counts} onView={show} onHelp={() => setHelp(true)} />

    <main className="workspace flex-1">
      <header className="topbar">
        <div className="flex shrink-0 items-center gap-2"><SidebarTrigger /><div className="breadcrumb"><LibraryBig size={17} /><span>Biblioteca</span><ChevronRight size={14} /><strong>{label}</strong></div></div>
        <div className="top-actions">
          {/* Chromium on iOS can add Autofill IDs to the search and sort controls before hydration. */}
          <label className="search-box"><Search size={18} /><Input ref={search} type="search" suppressHydrationWarning value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar livros…" aria-label="Buscar por título ou autor" /><kbd>Ctrl K</kbd></label>
          <Button type="button" onClick={() => setImporting(true)}><Plus size={19} /><span>Importar livro</span></Button>
        </div>
      </header>

      <div className="main-content">
        {featured && view === 'all' && !normalized && <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-kicker"><Sparkles size={15} />{featured.openedAt && featured.progress < 1 ? 'CONTINUE LENDO' : 'LEITURA EM DESTAQUE'}</div>
            <h1 id="hero-title">Sua próxima<br /><em>grande leitura.</em></h1>
            <div className="featured-label"><span>{featured.title}</span>{featured.level && <span className="hero-level">{featured.level}</span>}</div>
            <Button asChild className="hero-button"><Link href={`/read/${featured.id}`}><BookOpen size={18} />{featured.openedAt && featured.progress < 1 ? 'Continuar leitura' : 'Começar leitura'}<ArrowRight size={17} /></Link></Button>
          </div>
          <BookScene book={featured} />
        </section>}

        <section className="collection" aria-labelledby="collection-title">
          <div className="collection-head"><div><h2 id="collection-title">{normalized ? 'Resultados da busca' : label}</h2><p>{filtered.length} {filtered.length === 1 ? 'livro' : 'livros'} {view === 'all' && !normalized ? 'na sua biblioteca' : ''}</p></div>
            <div className="collection-actions">
              {levels.length > 0 && <div className="filters" aria-label="Filtrar por nível">
                <button type="button" className={level === 'all' ? 'selected' : ''} aria-pressed={level === 'all'} onClick={() => setLevel('all')}>Todos</button>
                {levels.map((value) => <button key={value} type="button" className={level === value ? 'selected' : ''} aria-pressed={level === value} onClick={() => setLevel(value)}>{value}</button>)}
              </div>}
              <label className="sort"><ArrowDownWideNarrow size={17} /><select aria-label="Ordenar livros" suppressHydrationWarning value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recentes</option><option value="title">Título A–Z</option></select></label>
            </div>
          </div>
          {filtered.length ? <div className="book-grid">{filtered.map((book) => <BookCard key={book.id} book={book} toggleFavorite={toggleFavorite} askDelete={setPendingDelete} editLevel={setEditingLevel} />)}</div> : <div className="empty-state">
            <span><BookOpen size={28} /></span><h3>{normalized || level !== 'all' ? 'Nenhum livro encontrado' : view === 'favorites' ? 'Seus favoritos aparecem aqui' : view === 'reading' ? 'Nenhuma leitura em andamento' : 'Sua estante está vazia'}</h3>
            {normalized || level !== 'all' ? <Button type="button" variant="outline" onClick={() => { setQuery(''); setLevel('all'); }}>Limpar filtros</Button> : view === 'all' ? <Button type="button" onClick={() => setImporting(true)}><Plus size={17} /> Importar livro</Button> : <Button type="button" variant="outline" onClick={() => show('all')}><ArrowLeft size={17} /> Voltar à estante</Button>}
          </div>}
        </section>
      </div>
    </main>

    {importing && <ImportDialog close={() => setImporting(false)} imported={imported} />}
    {editingLevel && <EditLevel book={editingLevel} close={() => setEditingLevel(null)} updated={(book) => {
      setBooks((current) => current.map((item) => item.id === book.id ? book : item));
      setEditingLevel(null);
      setLevel('all');
      setToast('Nível atualizado.');
    }} />}
    {help && <Modal close={() => setHelp(false)}><button type="button" className="icon-button modal-close" aria-label="Fechar" onClick={() => setHelp(false)}><X size={20} /></button><span className="modal-icon"><CircleHelp size={24} /></span><DialogTitle>Como importar</DialogTitle><DialogDescription>Baixe o livro no catálogo e abra no Folio.</DialogDescription><ol className="help-list"><li>Abra um livro no English e-Reader.</li><li>No menu de download, escolha <strong>EPUB</strong> para manter capa e capítulos, ou <strong>TXT</strong> para texto simples.</li><li>Adicione o arquivo baixado à sua estante.</li></ol><a href={EXAMPLE} target="_blank" rel="noreferrer" className="catalog-inline">Ver exemplo no catálogo <ArrowUpRight size={16} /></a><Button type="button" onClick={() => { setHelp(false); setImporting(true); }}><Plus size={18} /> Importar livro</Button></Modal>}
    {pendingDelete && <Modal close={() => { if (!saving) setPendingDelete(null); }}><DialogTitle>Remover livro?</DialogTitle><DialogDescription>“{pendingDelete.title}” e seu progresso de leitura serão removidos desta estante.</DialogDescription><div className="confirm-actions"><Button type="button" variant="outline" disabled={saving} onClick={() => setPendingDelete(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={saving} onClick={remove}>{saving ? 'Removendo…' : 'Remover'}</Button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button type="button" className="icon-button" aria-label="Dispensar mensagem" onClick={() => setToast('')}><X size={16} /></button></div>}
  </SidebarProvider>;
}
