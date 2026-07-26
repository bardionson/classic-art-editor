import { createGetLayerControlTokenValueFn } from '@/components/master-art-viewer/utils';
import {
  LayerRelativeTokenIdAndLever,
  LayerTransformationProperties,
} from '@/types/shared';
import { fetchIpfs } from '@/utils/ipfs';
import seedrandom from 'seedrandom';

/**
 * Builds a 4x5 SVG feColorMatrix "matrix" (identity, with an additive offset
 * in the 5th column of each RGB row) from per-channel offsets in this
 * collection's on-chain range (roughly -255..255). feColorMatrix values are
 * normalized 0-1, so each offset is divided by 255.
 */
export function buildRgbOffsetMatrix(
  red: number,
  green: number,
  blue: number,
): number[] {
  return [
    1,
    0,
    0,
    0,
    red / 255,
    0,
    1,
    0,
    0,
    green / 255,
    0,
    0,
    1,
    0,
    blue / 255,
    0,
    0,
    0,
    1,
    0,
  ];
}

/**
 * LayerImageElement is constructed with Builder design pattern.
 * We can't have our class directly extend HTMLImageElement since it would require us to switch to Web Components. (see TypeError: Illegal constructor)
 * It's also cleaner to separate object construction from representation in this case. (hence builder pattern)
 */

export interface LayerImageElement extends HTMLImageElement {
  naturalTop: number;
  naturalLeft: number;
  currentControlX?: number;
  currentControlY?: number;
  transformationProperties: LayerTransformationProperties;
  resize: (ratio: number) => void;
}

export default class LayerImageBuilder {
  private image: HTMLImageElement;

  private layoutVersion = 1;
  private anchorLayer: null | LayerImageElement = null;

  private transformationProperties: LayerTransformationProperties;
  private getLayerControlTokenValue: ReturnType<
    typeof createGetLayerControlTokenValueFn
  >;

  constructor(
    id: string,
    transformationProperties: LayerTransformationProperties,
    getLayerControlTokenValue: ReturnType<
      typeof createGetLayerControlTokenValueFn
    >,
  ) {
    this.image = new Image();
    this.image.id = id;
    this.image.alt = id;
    this.image.className = 'absolute';
    this.transformationProperties = transformationProperties;
    this.getLayerControlTokenValue = getLayerControlTokenValue;
  }

  setAnchorLayer(anchorLayer: LayerImageElement) {
    this.anchorLayer = anchorLayer;
  }

  setLayoutVersion(layoutVersion: number) {
    this.layoutVersion = layoutVersion;
  }

  async loadImage(
    uri: string,
    reportGateway: Parameters<typeof fetchIpfs>[1],
    cachedBlobUrl?: string,
  ) {
    if (cachedBlobUrl) {
      this.image.src = cachedBlobUrl;
    } else {
      const imageResponse = await fetchIpfs(uri, reportGateway);
      const imageBlob = await imageResponse.blob();
      this.image.src = URL.createObjectURL(imageBlob);
    }

    // Ensures that naturalWidth, naturalHeight, width and height properties are populated
    await new Promise((resolve) => {
      if (this.image.complete) return resolve(undefined);
      this.image.onload = () => resolve(undefined);
    });

    return this.image.src;
  }

  async build(): Promise<LayerImageElement> {
    await this.addOpacity();
    await this.addBlendMode();
    await this.addFilters();
    await this.addTransforms();
    await this.addPosition();

    const naturalTop = Number(this.image.style.top.split('px')[0] || 0);
    const naturalLeft = Number(this.image.style.left.split('px')[0] || 0);

    return Object.assign(this.image, {
      naturalTop,
      naturalLeft,
      transformationProperties: this.transformationProperties,
      resize: (ratio: number) => {
        this.image.style.maxWidth = `${this.image.naturalWidth * ratio}px`;
        this.image.style.maxHeight = `${this.image.naturalHeight * ratio}px`;
        this.image.style.top = `${naturalTop * ratio}px`;
        this.image.style.left = `${naturalLeft * ratio}px`;
      },
    });
  }

  private async readTransformationProperty(
    property: LayerRelativeTokenIdAndLever | number,
  ) {
    return typeof property === 'number'
      ? property
      : this.getLayerControlTokenValue(
          property['token-id'],
          property['lever-id'],
        );
  }

  private async addOpacity() {
    const opacity =
      this.transformationProperties.color?.alpha ||
      this.transformationProperties.color?.opacity;

    if (opacity) {
      this.image.style.opacity = String(
        (await this.readTransformationProperty(opacity)) / 100,
      );
    }
  }

  private async addBlendMode() {
    if (this.transformationProperties.color?.multiply)
      this.image.style.mixBlendMode = 'multiply';
    if (this.transformationProperties.color?.hardlight)
      this.image.style.mixBlendMode = 'hard-light';
    if (this.transformationProperties.color?.lighten)
      this.image.style.mixBlendMode = 'lighten';
    if (this.transformationProperties.color?.overlay)
      this.image.style.mixBlendMode = 'overlay';
    if (this.transformationProperties.color?.difference)
      this.image.style.mixBlendMode = 'difference';
    if (this.transformationProperties.color?.exclusion)
      this.image.style.mixBlendMode = 'exclusion';
    if (this.transformationProperties.color?.screen)
      this.image.style.mixBlendMode = 'screen';
  }

  private async addFilters() {
    const filters: string[] = [];

    if (this.transformationProperties.color?.hue) {
      const degrees = await this.readTransformationProperty(
        this.transformationProperties.color?.hue,
      );
      filters.push(`hue-rotate(${degrees}deg)`);
    }

    if (this.transformationProperties.color?.brightness) {
      const brightness = await this.readTransformationProperty(
        this.transformationProperties.color?.brightness,
      );
      if (brightness !== 0) filters.push(`brightness(${brightness / 100}%)`);
    }

    if (this.transformationProperties.color?.saturation) {
      const saturation = await this.readTransformationProperty(
        this.transformationProperties.color?.saturation,
      );
      if (saturation !== 0) filters.push(`saturate(${saturation}%)`);
    }

    const { red, green, blue, rgb, greyscale } =
      this.transformationProperties.color || {};

    if (red || green || blue || rgb) {
      const [redOffset, greenOffset, blueOffset, rgbOffset] = await Promise.all(
        [
          red ? this.readTransformationProperty(red) : 0,
          green ? this.readTransformationProperty(green) : 0,
          blue ? this.readTransformationProperty(blue) : 0,
          rgb ? this.readTransformationProperty(rgb) : 0,
        ],
      );

      const totalRed = redOffset + rgbOffset;
      const totalGreen = greenOffset + rgbOffset;
      const totalBlue = blueOffset + rgbOffset;

      if (totalRed !== 0 || totalGreen !== 0 || totalBlue !== 0) {
        const matrix = buildRgbOffsetMatrix(totalRed, totalGreen, totalBlue);
        filters.push(this.applyColorMatrixFilter(matrix));
      }
    }

    if (greyscale) {
      const greyscaleValue = await this.readTransformationProperty(greyscale);
      if (greyscaleValue !== 0) {
        filters.push(`brightness(${100 + (greyscaleValue / 255) * 100}%)`);
      }
    }

    this.image.style.filter = filters.join(' ');
  }

  /**
   * CSS `filter` has no native per-channel RGB adjustment (hue-rotate/
   * saturate/brightness all operate on the whole pixel), so this uses an SVG
   * feColorMatrix, referenced via `url(#id)` alongside the other chained CSS
   * filter functions. The filter def is keyed by this image's own (already
   * unique) id, so rebuilding the same layer updates the existing def's
   * `values` in place rather than leaking a new hidden <svg> into
   * document.body on every control change.
   */
  private applyColorMatrixFilter(matrix: number[]): string {
    const filterId = `layer-color-matrix-${this.image.id}`;
    let svg: Element | null = document.getElementById(`${filterId}-svg`);

    if (!svg) {
      const newSvg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      newSvg.setAttribute('id', `${filterId}-svg`);
      newSvg.setAttribute('width', '0');
      newSvg.setAttribute('height', '0');
      newSvg.style.position = 'absolute';
      newSvg.innerHTML = `<filter id="${filterId}"><feColorMatrix type="matrix" /></filter>`;
      document.body.appendChild(newSvg);
      svg = newSvg;
    }

    const feColorMatrix = svg.querySelector('feColorMatrix');
    feColorMatrix?.setAttribute('values', matrix.join(' '));

    return `url(#${filterId})`;
  }

  private async addTransforms() {
    const transforms: string[] = [];

    const { x = 100, y = 100 } = this.transformationProperties.scale || {};
    let scaleX = await this.readTransformationProperty(x);
    let scaleY = await this.readTransformationProperty(y);

    if (this.transformationProperties.mirror) {
      const { x, y } = this.transformationProperties.mirror;
      const mirrorX = await this.readTransformationProperty(x);
      const mirrorY = await this.readTransformationProperty(y);
      if (mirrorX) scaleX = -scaleX;
      if (mirrorY) scaleY = -scaleY;
    }

    transforms.push(`scale(${scaleX / 100}, ${scaleY / 100})`);

    if (this.transformationProperties['fixed-rotation']) {
      const fixedRotation = this.transformationProperties['fixed-rotation'];
      if ('random' in fixedRotation) {
        const date = new Date();
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        const maxValueExclusive = fixedRotation.random.max_value_inclusive + 1;
        const degrees =
          Math.floor(seedrandom(key)() * maxValueExclusive) *
          fixedRotation.multiplier;
        transforms.push(`rotate(-${degrees}deg)`);
      } else {
        const degrees = await this.readTransformationProperty(fixedRotation);
        transforms.push(
          `rotate(-${degrees * (fixedRotation.multiplier || 1)}deg)`,
        );
      }
    }

    this.image.style.transform = transforms.join(' ');
  }

  private async addPosition() {
    let currentControlX: number | undefined;
    let currentControlY: number | undefined;

    // anchor doesn't exist for fixed position layers
    const isPositionFixed =
      this.transformationProperties['fixed-position'] ||
      (!this.anchorLayer && this.transformationProperties['relative-position']);

    if (isPositionFixed) {
      const { x, y } =
        this.transformationProperties['fixed-position'] ||
        this.transformationProperties['relative-position']!;
      const fixedX = await this.readTransformationProperty(x);
      const fixedY = await this.readTransformationProperty(y);

      // Capture resolved control values if they are controllable (not static numbers)
      if (typeof x !== 'number') currentControlX = fixedX;
      if (typeof y !== 'number') currentControlY = fixedY;

      this.image.style.top = `${Math.floor(
        fixedY - this.image.naturalHeight / 2,
      )}px`;
      this.image.style.left = `${Math.floor(
        fixedX - this.image.naturalWidth / 2,
      )}px`;
    } else if (this.anchorLayer) {
      let baseX =
        this.anchorLayer.naturalLeft + this.anchorLayer.naturalWidth / 2;

      let baseY =
        this.anchorLayer.naturalTop + this.anchorLayer.naturalHeight / 2;

      if (this.transformationProperties['relative-position']) {
        const { x, y } = this.transformationProperties['relative-position'];
        let relativeX = await this.readTransformationProperty(x);
        let relativeY = await this.readTransformationProperty(y);

        // Capture resolved control values
        if (typeof x !== 'number') currentControlX = relativeX;
        if (typeof y !== 'number') currentControlY = relativeY;

        if (this.transformationProperties['orbit-rotation']) {
          const relativeRotation = await this.readTransformationProperty(
            this.transformationProperties['orbit-rotation'],
          );
          const unrotatedRelativeX = relativeX;
          const rad = (-relativeRotation * Math.PI) / 180;

          relativeX = Math.round(
            relativeX * Math.cos(rad) - relativeY * Math.sin(rad),
          );

          relativeY =
            this.layoutVersion === 1
              ? Math.round(
                  relativeY * Math.cos(rad) + relativeX * Math.sin(rad),
                )
              : Math.round(
                  relativeY * Math.cos(rad) +
                    unrotatedRelativeX * Math.sin(rad),
                );
        }

        baseX += relativeX;
        baseY += relativeY;
      }

      this.image.style.top = `${Math.floor(
        baseY - this.image.naturalHeight / 2,
      )}px`;
      this.image.style.left = `${Math.floor(
        baseX - this.image.naturalWidth / 2,
      )}px`;
    }

    // Attach values to image object for builder
    Object.assign(this.image, { currentControlX, currentControlY });
  }
}
