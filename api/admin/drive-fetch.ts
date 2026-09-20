import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, accessToken } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'Google Drive URL is required' });
  }

  function extractDriveFileId(raw: string): { id: string | null; type: 'file' | 'spreadsheet' | 'document' | 'unknown' } {
    if (!raw) return { id: null, type: 'unknown' };
    let type: 'file' | 'spreadsheet' | 'document' | 'unknown' = 'unknown';
    if (raw.includes('spreadsheets')) type = 'spreadsheet';
    else if (raw.includes('document')) type = 'document';
    else type = 'file';
    const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/) || raw.match(/id=([a-zA-Z0-9-_]+)/);
    return { id: match ? match[1] : null, type };
  }

  const { id, type } = extractDriveFileId(url);
  if (!id) {
    return res.status(400).json({ error: 'Could not extract Google Drive File ID from the provided URL' });
  }

  let downloadUrl = '';
  if (type === 'spreadsheet') downloadUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  else if (type === 'document') downloadUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
  else downloadUrl = `https://docs.google.com/uc?export=download&id=${id}`;

  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) throw new Error(`Google responded with status ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text') || contentType.includes('csv') || type === 'spreadsheet' || type === 'document') {
      const text = await response.text();
      return res.json({ id, type, name: `drive_file_${id}.${type === 'spreadsheet' ? 'csv' : 'txt'}`, mimeType: type === 'spreadsheet' ? 'text/csv' : 'text/plain', text });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.json({ id, type, name: `drive_file_${id}`, mimeType: contentType || 'application/octet-stream', data: buffer.toString('base64') });
  } catch (error: any) {
    return res.status(500).json({ error: `Could not retrieve file. Ensure the file is shared as "Anyone with the link". Details: ${error.message}` });
  }
}
