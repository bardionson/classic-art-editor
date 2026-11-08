import { it, expect } from 'vitest';
import sharp from 'sharp';
import { createArchiveImagePreview } from './archive-image-derivative';
it('fits the complete transparent canvas inside 1200 pixels without cropping or changing input bytes', async () => {
  const original = await sharp({
    create: {
      width: 2400,
      height: 1200,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const before = Buffer.from(original);
  const preview = await createArchiveImagePreview(original, 'image/png');
  expect(original).toEqual(before);
  const metadata = await sharp(preview!).metadata();
  expect(metadata).toMatchObject({
    format: 'webp',
    width: 1200,
    height: 600,
    hasAlpha: true,
  });
});
it('does not enlarge small images', async () => {
  const original = await sharp({
    create: { width: 20, height: 10, channels: 3, background: 'blue' },
  })
    .jpeg()
    .toBuffer();
  const preview = await createArchiveImagePreview(original, 'image/jpeg');
  expect(await sharp(preview!).metadata()).toMatchObject({
    width: 20,
    height: 10,
    format: 'webp',
  });
});
it('never decodes GIFs or video and rejects malformed static images', async () => {
  expect(
    await createArchiveImagePreview(Buffer.from('GIF89a'), 'image/gif'),
  ).toBeNull();
  expect(
    await createArchiveImagePreview(Buffer.from('video'), 'video/mp4'),
  ).toBeNull();
  await expect(
    createArchiveImagePreview(Buffer.from('bad png'), 'image/png'),
  ).rejects.toBeDefined();
});
it('rejects images above the bounded input pixel limit', async () => {
  const original = await sharp({
    create: { width: 6400, height: 6400, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await expect(
    createArchiveImagePreview(original, 'image/png'),
  ).rejects.toThrow(/pixel limit/i);
});

it('trims only empty alpha padding while preserving faint nontransparent boundary pixels', async () => {
  const width = 40,
    height = 30;
  const pixels = Buffer.alloc(width * height * 4);
  const pixel = (x: number, y: number, a: number) => {
    const offset = (y * width + x) * 4;
    pixels[offset] = 255;
    pixels[offset + 3] = a;
  };
  pixel(4, 5, 1);
  pixel(34, 24, 255);
  const original = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const preview = await createArchiveImagePreview(original, 'image/png');
  expect(await sharp(preview!).metadata()).toMatchObject({
    width: 31,
    height: 20,
    hasAlpha: true,
  });
  const { data, info } = await sharp(preview!)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(data[3]).toBeGreaterThan(0);
  expect(data[(info.width * info.height - 1) * 4 + 3]).toBeGreaterThan(0);
  expect(await sharp(original).metadata()).toMatchObject({ width, height });
});
it('keeps the complete opaque uniform background, even when alpha exists', async () => {
  const original = await sharp({
    create: {
      width: 80,
      height: 40,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const preview = await createArchiveImagePreview(original, 'image/png');
  expect(await sharp(preview!).metadata()).toMatchObject({
    width: 80,
    height: 40,
  });
});
