import Vocabulary from '@/components/vocabulary';
import { listVocabulary } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meu vocabulário', description: 'Revise as palavras e frases que você salvou durante a leitura e exporte seus cartões de estudo.' };

export default function VocabularyPage() {
  return <Vocabulary entries={listVocabulary()} />;
}
