// ─── Media Proxy Route Handler ───
// Proxies all /media/* requests to the Django backend so images load seamlessly without CORS/host issues.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'https://freshinbasket.com';

export async function GET(request, context) {
  const params = await context?.params;
  const path = params?.path;
  const rawSegments = Array.isArray(path) ? path.join('/') : (path || '');
  const cleanSegments = rawSegments.replace(/^\/+|\/+$/g, '');

  const url = new URL(request.url);
  const cleanOrigin = BACKEND_ORIGIN.replace(/\/+$/, '');
  const targetUrl = `${cleanOrigin}/media/${cleanSegments}${url.search}`;

  try {
    const backendRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*,*/*',
      },
      cache: 'no-store',
    });

    if (!backendRes.ok) {
      // If 404 on local backend, try production freshinbasket.com fallback
      if (cleanOrigin !== 'https://freshinbasket.com') {
        const prodUrl = `https://freshinbasket.com/media/${cleanSegments}${url.search}`;
        const prodRes = await fetch(prodUrl, { cache: 'no-store' });
        if (prodRes.ok) {
          const prodHeaders = new Headers(prodRes.headers);
          return new Response(prodRes.body, {
            status: prodRes.status,
            headers: prodHeaders,
          });
        }
      }
      return new Response(null, { status: backendRes.status });
    }

    const resHeaders = new Headers(backendRes.headers);
    resHeaders.delete('transfer-encoding');
    resHeaders.delete('content-encoding');

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(null, { status: 404 });
  }
}
