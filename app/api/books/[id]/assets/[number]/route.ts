import { readAsset } from '../../../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: RouteContext<'/api/books/[id]/assets/[number]'>) {
  const { id, number } = await params;
  const asset = /^\d+$/.test(number) && readAsset(id, Number(number));
  if (!asset) return new Response(null, { status: 404 });
  return new Response(asset.bytes, { headers: {
    'Content-Type': asset.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600, immutable',
  } });
}
