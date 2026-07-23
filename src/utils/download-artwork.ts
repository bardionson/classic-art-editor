import { toBlob } from 'html-to-image';

/**
 * Captures the given DOM node (the composited artwork stack) as a PNG blob
 * at native artwork resolution and triggers a browser download.
 *
 * @param pixelRatio - pass 1 / resizeToFitScreenRatio to recover native
 *   source resolution regardless of current on-screen/viewport size.
 * @param filename - full filename including extension, e.g. "my-art-42.png"
 */
export async function downloadFlattenedArtwork(
  node: HTMLElement,
  pixelRatio: number,
  filename: string,
): Promise<void> {
  const blob = await toBlob(node, {
    pixelRatio,
    backgroundColor: '#ffffff', // composited layers can have partial opacity/holes
    cacheBust: false, // layer <img> srcs are blob: URLs, already same-origin
  });

  if (!blob) {
    throw new Error('Failed to generate artwork image.');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Builds a filesystem-safe PNG filename from an artwork name and token id.
 */
export function buildArtworkFilename(
  name: string | undefined,
  tokenId: number,
): string {
  const base =
    (name ?? 'artwork')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'artwork';

  return `${base}-${tokenId}.png`;
}
