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
 * html-to-image's SVG-based capture is sensitive to the target node's own
 * page-relative (viewport) offset, not just its local coordinate space -
 * verified empirically: a master art container centered via flex/mx-auto
 * (e.g. sitting at page x=250 in a wider viewport) produces a download
 * missing exactly its own left offset in width, with everything from that
 * x-coordinate on rendering correctly. A node sitting at page (0,0) is
 * unaffected. Rather than move the live, visible artwork (which would
 * flash to the top-left corner for the duration of the capture), this
 * captures a detached CLONE pinned to page (0,0) with a z-index low enough
 * to render behind all real page content, so it's never visible to the
 * user, then removes it once the capture finishes (success or failure).
 */
async function captureAtZeroOffset(
  node: HTMLElement,
  options: Parameters<typeof toBlob>[1],
): Promise<Blob | null> {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.top = '0px';
  clone.style.left = '0px';
  clone.style.margin = '0px';
  clone.style.pointerEvents = 'none';
  clone.style.zIndex = '-2147483000';
  document.body.appendChild(clone);

  try {
    const images = Array.from(clone.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          }),
      ),
    );

    return await toBlob(clone, options);
  } finally {
    document.body.removeChild(clone);
  }
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

  const blob = await captureAtZeroOffset(node, {
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
