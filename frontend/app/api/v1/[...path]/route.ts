import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getBackendBaseUrl(): string | null {
  const fromEnv =
    process.env.API_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '') : undefined);

  const base = typeof fromEnv === 'string' ? fromEnv.trim() : '';
  if (!base) return null;
  return base.replace(/\/+$/, '');
}

async function proxy(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const backendBase = getBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Backend URL is not configured. Set API_BASE_URL (recommended) or NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.',
      },
      { status: 500 },
    );
  }

  const { path = [] } = await ctx.params;
  const url = new URL(req.url);
  const target = new URL(`${backendBase}/api/v1/${path.join('/')}`);
  target.search = url.search;

  const headers = new Headers(req.headers);
  // Ensure host/origin headers don't confuse upstream
  headers.delete('host');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const resHeaders = new Headers(upstream.headers);
  // Avoid leaking hop-by-hop headers
  resHeaders.delete('transfer-encoding');
  resHeaders.delete('content-encoding');

  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, { status: upstream.status, headers: resHeaders });
  }

  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: resHeaders });
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

