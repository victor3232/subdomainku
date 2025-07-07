
import { NextRequest } from 'next/server';
import { createSubdomain } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  const { subdomain, ip, domain } = await req.json();
  const result = await createSubdomain(subdomain, ip, domain);
  return Response.json(result);
}
