
import { NextRequest } from 'next/server';
import { updateSubdomainIP } from '../../../../lib/cloudflare';

export async function POST(req: NextRequest) {
  const { subdomain, ip, domain } = await req.json();
  const result = await updateSubdomainIP(subdomain, ip, domain);
  return Response.json(result);
}
