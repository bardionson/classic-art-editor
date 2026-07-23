import { toBlob } from 'html-to-image';

/**
 * html-to-image clips its capture to the node's own declared
 * clientWidth/clientHeight, ignoring any child that's positioned or sized
 * beyond that box. Layers are absolutely positioned from the NFT's layout
 * metadata and aren't guaranteed to stay within the container's own
 * width/height (which comes from a separate reference master image), so a
 * layer that extends past the right/bottom edge gets silently cut off
 * unless we tell html-to-image the true content bounds explicitly.
 */
function getContentBounds(node: HTMLElement): {
  width: number;
  height: number;
} {
  let maxRight = node.clientWidth;
  let maxBottom = node.clientHeight;

  for (const child of Array.from(node.children)) {
    const el = child as HTMLElement;
    maxRight = Math.max(maxRight, el.offsetLeft + el.offsetWidth);
    maxBottom = Math.max(maxBottom, el.offsetTop + el.offsetHeight);
  }

  return { width: maxRight, height: maxBottom };
}

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
  const { width, height } = getContentBounds(node);

  const blob = await toBlob(node, {
    pixelRatio,
    width,
    height,
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
