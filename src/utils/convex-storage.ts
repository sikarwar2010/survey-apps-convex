import type { Id } from '@/convex/_generated/dataModel';
import * as ImageManipulator from 'expo-image-manipulator';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jpegUploadBody(bytes: Uint8Array): Blob {
  // Copy so BlobPart typing is satisfied (Uint8Array may use SharedArrayBuffer backing).
  return new Blob([Uint8Array.from(bytes)], { type: 'image/jpeg' });
}

/** POST image bytes from a local URI to a Convex storage upload URL. */
export async function uploadImageFromUri(
  uploadUrl: string,
  uri: string,
): Promise<{ storageId: Id<'_storage'>; sizeKb: number }> {
  const processed = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!processed.base64) {
    throw new Error('Photo upload failed');
  }
  const jpegBytes = base64ToBytes(processed.base64);
  const result = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: jpegUploadBody(jpegBytes),
  });
  if (!result.ok) {
    throw new Error('Photo upload failed');
  }
  const json = (await result.json()) as { storageId: Id<'_storage'> };
  return { storageId: json.storageId, sizeKb: Math.max(1, Math.ceil(jpegBytes.byteLength / 1024)) };
}
