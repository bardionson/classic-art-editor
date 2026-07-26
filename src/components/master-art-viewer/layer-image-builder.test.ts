import { describe, it, expect } from 'vitest';
import { buildRgbOffsetMatrix } from './layer-image-builder';

describe('buildRgbOffsetMatrix', () => {
  it('produces an identity matrix for zero offsets', () => {
    expect(buildRgbOffsetMatrix(0, 0, 0)).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
  });

  it('places a positive red offset in the red row (index 4), normalized by 255', () => {
    const matrix = buildRgbOffsetMatrix(255, 0, 0);
    expect(matrix[4]).toBe(1);
    expect(matrix[9]).toBe(0);
    expect(matrix[14]).toBe(0);
  });

  it('places offsets in the correct row for green and blue independently', () => {
    const matrix = buildRgbOffsetMatrix(0, 127.5, -255);
    expect(matrix[4]).toBe(0);
    expect(matrix[9]).toBeCloseTo(0.5);
    expect(matrix[14]).toBe(-1);
  });

  it('leaves the alpha row and off-diagonal terms untouched (identity elsewhere)', () => {
    const matrix = buildRgbOffsetMatrix(100, -50, 20);
    // Off-diagonal RGB terms (diagonal indices 0, 6, 12 and offset columns
    // 4, 9, 14 are intentionally excluded)
    expect([
      matrix[1],
      matrix[2],
      matrix[3],
      matrix[5],
      matrix[7],
      matrix[8],
      matrix[10],
      matrix[11],
      matrix[13],
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // Diagonal RGB terms stay 1
    expect([matrix[0], matrix[6], matrix[12]]).toEqual([1, 1, 1]);
    // Alpha row: passthrough, no offset
    expect(matrix.slice(15, 20)).toEqual([0, 0, 0, 1, 0]);
  });
});
