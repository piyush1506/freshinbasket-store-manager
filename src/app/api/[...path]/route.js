// ─── API Proxy Route Handler ───
// Proxies all /api/* requests to the production or local backend, avoiding CORS issues.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'https://freshinbasket.com';

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
}

async function proxyRequest(request, context) {
  const params = await context?.params;
  const path = params?.path;
  const rawSegments = Array.isArray(path) ? path.join('/') : (path || '');
  const cleanSegments = rawSegments.replace(/^\/+|\/+$/g, '');

  // Build the target URL cleanly, ensuring standard Django trailing slash
  const url = new URL(request.url);
  const cleanOrigin = BACKEND_ORIGIN.replace(/\/+$/, '');
  const isFile = cleanSegments.split('/').pop()?.includes('.') || false;
  const trailingSlash = isFile ? '' : '/';
  const targetUrl = `${cleanOrigin}/api/${cleanSegments}${trailingSlash}${url.search}`;

  // Forward headers but strip host (the backend needs its own host header)
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-For', request.headers.get('x-forwarded-for') || '127.0.0.1');

  const init = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  // Forward body for non-GET/HEAD requests only when present
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        init.body = buffer;
        init.duplex = 'half';
      }
    } else {
      const text = await request.text();
      if (text && text.length > 0) {
        init.body = text;
        init.duplex = 'half';
      }
    }
  }

  try {
    const backendRes = await fetch(targetUrl, init);

    const resHeaders = new Headers(backendRes.headers);
    resHeaders.delete('transfer-encoding');
    resHeaders.delete('content-encoding');

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return Response.json(
      { error: 'Proxy error', detail: err.message, targetUrl },
      { status: 502 }
    );
  }
}
