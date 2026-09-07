import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, accessToken } = req.body || {};

  const telegramId = (req.headers['x-telegram-id'] as string) || '';
  const allowedIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (!allowedIds.includes(telegramId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!url) {
    return res.status(400).json({ error: 'Google Drive URL is required' });
  }

  function extractDriveFileId(url: string): { id: string | null; type: 'file' | 'spreadsheet' | 'document' | 'unknown' } {
    if (!url) return { id: null, type: 'unknown' };
    let id: string | null = null;
    let type: 'file' | 'spreadsheet' | 'document' | 'unknown' = 'unknown';

    if (url.includes('spreadsheets')) {
      type = 'spreadsheet';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    } else if (url.includes('document')) {
      type = 'document';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    } else {
      type = 'file';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
      id = match ? match[1] : null;
    }
    return { id, type };
  }

  const { id, type } = extractDriveFileId(url);
  if (!id) {
    return res.status(400).json({ error: 'Could not extract Google Drive File ID from the provided URL' });
  }

  let downloadUrl = '';
  if (type === 'spreadsheet') {
    downloadUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  } else if (type === 'document') {
    downloadUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
  } else {
    downloadUrl = `https://docs.google.com/uc?export=download&id=${id}`;
  }

  try {
    console.log(`[DRIVE FETCH] Downloading ID ${id} (${type}) from ${downloadUrl}`);
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(downloadUrl, { headers });

    if (!response.ok) {
      throw new Error(`Google responded with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text') || contentType.includes('csv') || type === 'spreadsheet' || type === 'document') {
      const text = await response.text();
      return res.json({
        id,
        type,
        name: `drive_file_${id}.${type === 'spreadsheet' ? 'csv' : 'txt'}`,
        mimeType: type === 'spreadsheet' ? 'text/csv' : 'text/plain',
        text: text
      });
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      return res.json({
        id,
        type,
        name: `drive_file_${id}`,
        mimeType: contentType || 'application/octet-stream',
        data: base64
      });
    }
  } catch (error: any) {
    console.error('[DRIVE FETCH] Failed to retrieve Google Drive file:', error);
    return res.status(500).json({
      error: `Could not retrieve file. Please ensure the file is shared as "Anyone with the link" or sign in with Google. Details: ${error.message}`
    });
  }
}
