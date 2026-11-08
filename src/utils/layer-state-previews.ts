import { imageCandidates } from '@/utils/archive-media';

type VisualStateLayer = {
  id?: string;
  states?: {
    'token-id'?: number;
    'lever-id'?: number;
    options?: { uri?: string; states?: unknown }[];
  };
};

// Match the same relative token and lever as the renderer. Music's control
// label often names the small mix indicator; the old server used the OTHER
// visual layer sharing that control for its state preview (saveStatePreviewsAudio).
export function getLayerStatePreviews(
  layers: readonly VisualStateLayer[] | undefined,
  masterTokenId: number | undefined,
  layerTokenId: number,
  leverId: number,
  controlLabel: string,
  isMusic: boolean,
): (string | null)[] {
  if (
    !layers ||
    !Number.isSafeInteger(masterTokenId) ||
    !Number.isSafeInteger(layerTokenId)
  )
    return [];
  const relativeId = layerTokenId - masterTokenId!;
  const matches = layers.filter(
    (layer) =>
      layer.states?.['token-id'] === relativeId &&
      layer.states?.['lever-id'] === leverId &&
      Array.isArray(layer.states?.options),
  );
  const label = controlLabel.replace(/ \(STATE\)$/, '');
  const selected = isMusic
    ? (matches.find((layer) => layer.id !== label) ?? matches[0])
    : (matches.find((layer) => layer.id === label) ?? matches[0]);
  return (
    selected?.states?.options?.map((option) =>
      typeof option.uri === 'string' && imageCandidates(option.uri).length
        ? option.uri
        : null,
    ) ?? []
  );
}
