import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

const root = path.resolve(env.UPLOAD_DIR);

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Identifies an image from its first bytes, so a file cannot lie about its declared type. */
export function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Stores a fuel-proof photo and returns its path relative to UPLOAD_DIR. */
export async function saveFuelPhoto(claimId: string, buffer: Buffer, mime: string): Promise<string> {
  const relative = path.join('fuel-claims', `${claimId}.${EXTENSIONS[mime] ?? 'bin'}`);
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);
  return relative;
}

export function uploadPath(relative: string): string {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Invalid upload path');
  return absolute;
}

export async function removeUpload(relative: string): Promise<void> {
  try {
    await unlink(uploadPath(relative));
  } catch {
    // already gone; nothing to clean up
  }
}
