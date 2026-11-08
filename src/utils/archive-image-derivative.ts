import sharp from 'sharp';
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const staticPreviewType = (type: string) =>
  ['image/png', 'image/jpeg', 'image/webp'].includes(type);

export async function createArchiveImagePreview(
  body: Uint8Array,
  type: string,
) {
  if (!staticPreviewType(type)) return null;
  const image = sharp(body, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'warning',
    sequentialRead: true,
  });
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) > 1) return null;
  // Only empty alpha padding is removed. Color, including opaque uniform
  // backgrounds, never participates in the crop decision.
  if (metadata.hasAlpha) {
    const { data, info } = await image
      .clone()
      .extractChannel('alpha')
      .raw({ depth: 'ushort' })
      .toBuffer({ resolveWithObject: true });
    let left = info.width,
      top = info.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data.readUInt16LE((y * info.width + x) * 2) > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (
      right >= left &&
      bottom >= top &&
      (left || top || right < info.width - 1 || bottom < info.height - 1)
    ) {
      image.extract({
        left,
        top,
        width: right - left + 1,
        height: bottom - top + 1,
      });
    }
  }
  const output = await image
    .resize({
      width: 1200,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  if (output.byteLength > MAX_PREVIEW_BYTES)
    throw new Error('Preview exceeds limit');
  return output;
}
