import type { CoverBook } from '../lib/types';

export function Cover({ book, className = '' }: { book: CoverBook; className?: string }) {
  return (
    <div className={`cover ${className}`} aria-hidden="true">
      {book.cover ? <img src={book.cover} alt="" /> : <>
        <span className="cover-imprint">FOLIO</span>
        <strong>{book.title}</strong>
        <i />
        <span className="cover-edition">{book.level || book.format}</span>
      </>}
    </div>
  );
}
