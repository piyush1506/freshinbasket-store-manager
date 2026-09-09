import { getAccessToken } from './auth';

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const token = getAccessToken();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${apiBase}/api/v1/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Upload failed');
  }

  const data = await res.json();
  return data.url;
}
