import type { Id } from '@/convex/_generated/dataModel';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type SurveyPhotoPickResult =
  | { canceled: true }
  | {
      canceled: false;
      uri: string;
      width: number;
      height: number;
      jpegBytes: Uint8Array;
    };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toCaptureError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  if (/split bundle|ERR_NGROK|ngrok|offline|Unable to resolve module/i.test(raw)) {
    return new Error(
      'Camera could not open. Restart the dev server and reopen the app, or use a release build in the field.',
    );
  }
  if (e instanceof Error) return e;
  return new Error(raw || 'Photo capture failed');
}

/** Opens the device camera and returns a compressed JPEG ready to upload. */
export async function pickSurveyPhotoFromCamera(): Promise<SurveyPhotoPickResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Camera permission is required to capture survey photos');
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
      allowsEditing: false,
      ...(Platform.OS === 'android' ? { skipProcessing: true as const } : {}),
    });

    if (picked.canceled || picked.assets.length === 0) {
      return { canceled: true };
    }

    const compressed = await ImageManipulator.manipulateAsync(picked.assets[0].uri, [{ resize: { width: 1280 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (!compressed.base64) {
      throw new Error('Photo processing failed — try again');
    }

    return {
      canceled: false,
      uri: compressed.uri,
      width: compressed.width,
      height: compressed.height,
      jpegBytes: base64ToBytes(compressed.base64),
    };
  } catch (e) {
    throw toCaptureError(e);
  }
}

/** Loads camera native module early so the first tap does not fetch a dev split bundle. */
export async function warmCameraModule(): Promise<void> {
  await ImagePicker.getCameraPermissionsAsync();
}

/** POST JPEG bytes to a Convex storage upload URL (no file:// fetch). */
export async function uploadSurveyPhotoBytes(
  uploadUrl: string,
  jpegBytes: Uint8Array,
): Promise<{ storageId: Id<'_storage'>; sizeKb: number }> {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: new Blob([Uint8Array.from(jpegBytes)], { type: 'image/jpeg' }),
  });
  if (!res.ok) {
    throw new Error(`Photo upload failed (${res.status})`);
  }
  const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
  return { storageId, sizeKb: Math.max(1, Math.ceil(jpegBytes.byteLength / 1024)) };
}
