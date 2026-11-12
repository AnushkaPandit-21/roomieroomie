import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_DIMENSION = 1080;
// ~200 KB for a 1080px photo (CLAUDE.md §9).
const WEBP_QUALITY = 0.7;

export type PreparedPhoto = { uri: string; bytes: Uint8Array };

export async function pickImages(limit: number): Promise<ImagePicker.ImagePickerAsset[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  return result.canceled ? [] : result.assets.slice(0, limit);
}

// Longest side ≤ 1080px, re-encoded as WebP, returned as bytes ready for Supabase Storage.
export async function prepareWebp(asset: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'width' | 'height'>): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_DIMENSION) {
    context.resize(asset.width >= asset.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: WEBP_QUALITY });
  const bytes = await new File(saved.uri).bytes();
  return { uri: saved.uri, bytes };
}
