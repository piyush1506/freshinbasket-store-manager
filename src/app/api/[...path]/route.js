// ─── API Proxy Route Handler ───
// Proxies all /api/* requests to the production or local backend, avoiding CORS issues.

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
  const params = await context.params;
  const path = params?.path;
  const segments = Array.isArray(path) ? path.join('/') : (path || '');

  // Build the target URL, preserving trailing slash and query string
  const url = new URL(request.url);
  const cleanOrigin = BACKEND_ORIGIN.replace(/\/+$/, '');
  const hasTrailingSlash = url.pathname.endsWith('/') || !segments.includes('.');
  const targetUrl = `${cleanOrigin}/api/${segments}${hasTrailingSlash ? '/' : ''}${url.search}`;

  // Forward headers but strip host (the backend needs its own host header)
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-For', request.headers.get('x-forwarded-for') || '127.0.0.1');

  const init = {
    method: request.method,
    headers,
  };

  // Forward body for non-GET/HEAD requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      init.body = await request.arrayBuffer();
    } else {
      init.body = await request.text();
    }
    init.duplex = 'half';
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
