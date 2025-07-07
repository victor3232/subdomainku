
import { NextRequest } from 'next/server';
import { listSubdomains } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  const { domain } = await req.json();
  const result = await listSubdomains(domain);
  return Response.json(result);
}
