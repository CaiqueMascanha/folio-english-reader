'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Download, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { VocabularyEntry } from '@/lib/types';

const formats = {
  noji: ['Noji · CSV', 'No Noji na web, abra um deck e use Import Cards. Escolha vírgula como separador.'],
  anki: ['Anki · TXT', 'No Anki, importe como nota Básica. A primeira coluna é a frente e a segunda é o verso.'],
  flashcards: ['Outros flashcards · TXT', 'Cada linha contém frente e verso separados por tabulação.'],
  csv: ['CSV completo', 'Inclui significado, contexto, livro e capítulo.'],
  txt: ['TXT para leitura', 'Lista em texto simples com os dados de cada trecho.'],
  xlsx: ['Excel · XLSX', 'Planilha com significado, contexto, livro e capítulo.'],
} as const;

export default function Vocabulary({ entries }: { entries: VocabularyEntry[] }) {
  const [items, setItems] = useState(entries);
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<keyof typeof formats>('noji');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const visible = items.filter((item) => [item.text, item.meaning, item.bookTitle].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())));
  return <main className="vocab-page">
    <Button asChild variant="outline"><Link href="/"><ArrowLeft size={18} /> Minha estante</Link></Button>
    <h1>Meu vocabulário</h1>
    <p>{items.length} {items.length === 1 ? 'trecho salvo' : 'trechos salvos'}</p>
    {items.length > 0 && <>
      <section className="vocab-export" aria-label="Exportar vocabulário">
        <label className="source-field">Destino ou formato
          <select suppressHydrationWarning value={format} onChange={(event) => setFormat(event.target.value as keyof typeof formats)}>
            {Object.entries(formats).map(([key, [name]]) => <option value={key} key={key}>{name}</option>)}
          </select>
        </label>
        <Button asChild><a href={`/api/vocabulary/export?format=${format}`} download><Download size={17} /> Baixar vocabulário</a></Button>
        <p>{formats[format][1]}</p>
      </section>
      <label className="source-field vocab-search">Buscar no vocabulário<Input suppressHydrationWarning type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </>}
    {visible.length === 0 && <p>{items.length ? 'Nenhum trecho encontrado.' : 'Abra um livro, selecione uma palavra ou frase e toque em Salvar trecho.'}</p>}
    <ul className="vocab-list">{visible.map((entry) => <li key={entry.id} className="vocab-entry">
      <h2 lang="en">{entry.text}</h2><p>{entry.meaning || 'A revisar'}</p>
      {entry.context && <blockquote lang="en">{entry.context}</blockquote>}
      <small>{entry.bookTitle} · {entry.chapterTitle}</small>
      {editing === entry.id ? <form className="vocab-form" onSubmit={async (event) => {
        event.preventDefault();
        const meaning = String(new FormData(event.currentTarget).get('meaning') || '').trim();
        setError('');
        try {
          const response = await fetch('/api/vocabulary', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id, meaning }) });
          if (!response.ok) throw new Error();
          setItems((current) => current.map((item) => item.id === entry.id ? { ...item, meaning } : item));
          setEditing(null);
        } catch { setError('Não foi possível salvar o significado.'); }
      }}><label className="source-field">Significado ou tradução<textarea name="meaning" defaultValue={entry.meaning} maxLength={1000} /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="vocab-edit"><Button type="submit">Salvar</Button><Button variant="outline" type="button" onClick={() => setEditing(null)}>Cancelar</Button></div>
      </form> : <Button variant="outline" type="button" onClick={() => { setError(''); setEditing(entry.id); }}><Pencil size={15} /> Editar significado</Button>}
    </li>)}</ul>
  </main>;
}
