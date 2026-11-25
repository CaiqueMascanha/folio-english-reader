import Link from 'next/link';

export default function NotFound() {
  return <main className="not-found"><h1>Livro não encontrado</h1><Link className="button button-lime" href="/">Voltar à estante</Link></main>;
}
