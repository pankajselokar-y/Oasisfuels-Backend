import { MAX_PHOTO_BYTES } from '../config/constants.js';
import { badRequest } from './AppError.js';

/** Turns a base64 `data:image/...` URI (what the app sends) into the image bytes, refusing oversized photos. */
export function decodePhotoDataUri(dataUri: string): Buffer {
  const buffer = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) throw badRequest('The photo is too large (max 5 MB).');
  return buffer;
}
