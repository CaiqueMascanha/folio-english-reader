import { cookies } from 'next/headers';
import Library from '../components/library';
import { listBooks } from '../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Home() {
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  return <Library initialBooks={listBooks()} sidebarOpen={sidebarOpen} />;
}
