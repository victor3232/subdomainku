
import { NextRequest } from 'next/server';
import { deleteSubdomain } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  const { subdomain, domain } = await req.json();
  const result = await deleteSubdomain(subdomain, domain);
  return Response.json(result);
}
