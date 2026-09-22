  import { getAccessToken } from './auth';

/**
 * Normalizes any image URL (handles relative media paths from Django backend,
 * nested/duplicated Cloudinary URLs, blob URLs, data URLs, and absolute remote URLs).
 */
export function getImageUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Handle protocol-relative URLs (e.g. //res.cloudinary.com/...)
  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  }

  // 2. Handle URL-encoded double protocols (e.g. https%3A%2F%2F or media/https)
  try {
    if (trimmed.includes('%3A') || trimmed.includes('%2F')) {
      const decoded = decodeURIComponent(trimmed);
      const lastHttp = Math.max(decoded.lastIndexOf('https://'), decoded.lastIndexOf('http://'));
      if (lastHttp >= 0) {
        trimmed = decoded.substring(lastHttp);
      }
    }
  } catch {
    // Ignore URI decode errors
  }

  // 3. Fix nested/duplicated URLs (e.g. https://res.cloudinary.com/.../media/https://...)
  const lastHttps = trimmed.lastIndexOf('https://');
  const lastHttp = trimmed.lastIndexOf('http://');
  const lastHttpIndex = Math.max(lastHttps, lastHttp);
  if (lastHttpIndex > 0) {
    trimmed = trimmed.substring(lastHttpIndex);
  }

  // 4. Upgrade http:// to https:// for Cloudinary to prevent Mixed Content blocking on HTTPS sites
  if (trimmed.startsWith('http://res.cloudinary.com')) {
    trimmed = trimmed.replace('http://', 'https://');
  }

  // 5. Fix malformed single-slash protocols like https:/res.cloudinary.com
  if (trimmed.startsWith('https:/') && !trimmed.startsWith('https://')) {
    trimmed = trimmed.replace('https:/', 'https://');
  } else if (trimmed.startsWith('http:/') && !trimmed.startsWith('http://')) {
    trimmed = trimmed.replace('http:/', 'http://');
  }

  // 6. If it's already a complete valid web URL or blob/data preview
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // 7. Handle relative media paths from Django backend (e.g. "media/products/img.png" or "products/img.png")
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwxiu6x7p';
  let relativePath = trimmed.replace(/^\/+/, '');

  // Strip duplicate media/ prefixes if present (e.g. "media/media/...")
  while (relativePath.startsWith('media/media/')) {
    relativePath = relativePath.substring(6);
  }

  if (!relativePath.startsWith('media/')) {
    relativePath = `media/${relativePath}`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/v1/${relativePath}`;
}

/**
 * Detects if a Cloudinary URL is nested/duplicated
 * e.g. https://res.cloudinary.com/.../media/https://res.cloudinary.com/...
 */
export function isNestedCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Count occurrences of https:// or http:// — if more than one, it's nested
  const matches = trimmed.match(/https?:\/\//g);
  if (matches && matches.length > 1) return true;
  // Also check for URL-encoded nesting or /media/http
  if (trimmed.includes('%3A%2F%2F') && trimmed.includes('cloudinary')) return true;
  if (trimmed.includes('/media/http')) return true;
  return false;
}

/**
 * Extracts the correct relative media path from a Cloudinary URL for saving to the Django backend.
 * 
 * Django's CloudinaryField stores relative paths like "products/image_name".
 * When serialized, it constructs: https://res.cloudinary.com/{cloud}/image/upload/v1/media/{path}
 * 
 * If we send a full Cloudinary URL as the field value, Django stores it literally,
 * causing double-nesting on next retrieval.
 * 
 * This function extracts the relative path from:
 * - Nested URLs:  .../media/https://res.cloudinary.com/.../freshinbasket/products/xyz.png → products/xyz.png
 * - Full URLs:    https://res.cloudinary.com/.../media/products/xyz → products/xyz
 * - Already relative: products/xyz → products/xyz (unchanged)
 */
export function cleanImageUrlForBackend(url) {
  if (!url || typeof url !== 'string') return url;
  let trimmed = url.trim();

  // Decode URL-encoded characters first
  try {
    if (trimmed.includes('%3A') || trimmed.includes('%2F')) {
      trimmed = decodeURIComponent(trimmed);
    }
  } catch {
    // Ignore decode errors
  }

  // If it's a nested URL, extract the innermost full URL first
  const lastHttps = trimmed.lastIndexOf('https://');
  const lastHttp = trimmed.lastIndexOf('http://');
  const lastHttpIndex = Math.max(lastHttps, lastHttp);
  if (lastHttpIndex > 0) {
    trimmed = trimmed.substring(lastHttpIndex);
  }

  // If it's a full Cloudinary URL, extract the relative media path
  // Pattern: https://res.cloudinary.com/{cloud}/image/upload/{version}/{folder}/...
  const cloudinaryPattern = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)$/;
  const match = trimmed.match(cloudinaryPattern);
  if (match) {
    let relativePath = match[1];
    // Remove leading "media/" since Django adds that automatically
    if (relativePath.startsWith('media/')) {
      relativePath = relativePath.substring(6);
    }
    // Remove "freshinbasket/" prefix if present (upload endpoint uses different folder)
    if (relativePath.startsWith('freshinbasket/')) {
      relativePath = relativePath.substring(14);
    }
    return relativePath;
  }

  // If it's already a relative path, strip leading /media/
  if (trimmed.startsWith('/media/')) {
    return trimmed.substring(7);
  }
  if (trimmed.startsWith('media/')) {
    return trimmed.substring(6);
  }

  // Return as-is if it's already a clean relative path
  return trimmed;
}

/**
 * Upload an image file to the backend /api/v1/upload/ endpoint.
 * Returns the resolved uploaded image URL string.
 */
export async function uploadImage(file) {
  if (!file) return null;

  const formData = new FormData();
  formData.append('image', file);

  const token = getAccessToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const url = apiBase ? `${apiBase.replace(/\/+$/, '')}/api/v1/upload/` : '/api/v1/upload/';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res && res.ok) {
      const data = await res.json();
      const resolvedUrl =
        data.url ||
        data.secure_url ||
        data.image_url ||
        data.image ||
        data.file ||
        data.data?.url ||
        data.data?.image_url;

      if (resolvedUrl) return resolvedUrl;
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || err.message || `Upload failed with status ${res.status}`);
  } catch (e) {
    throw new Error(e.message || 'Image upload failed');
  }
}

/**
 * Directly updates a product's image via PATCH /api/v1/products/{id}/
 * using multipart/form-data as expected by Django REST Framework ProductSerializer.
 */
export async function updateProductImage(productId, file) {
  if (!productId || !file) {
    throw new Error('Product ID and file are required');
  }

  const formData = new FormData();
  formData.append('image', file);

  const token = getAccessToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const url = apiBase
    ? `${apiBase.replace(/\/+$/, '')}/api/v1/products/${productId}/`
    : `/api/v1/products/${productId}/`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err.detail ||
      err.error ||
      (typeof err.image === 'string' ? err.image : Array.isArray(err.image) ? err.image.join(', ') : null) ||
      `Failed to update product image (status ${res.status})`;
    throw new Error(msg);
  }

  return await res.json();
}

