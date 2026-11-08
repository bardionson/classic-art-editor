export type ControlDefinition = {
  minValue: number;
  maxValue: number;
  startValue?: number;
  label: string;
  controlType: string;
  stateLabels?: string[];
};

// The original contracts return one min/max/current triplet per lever.
export function readControlValues(raw: readonly bigint[], count: number) {
  if (raw.length < count * 3) throw new Error('Incomplete on-chain controls.');
  return Array.from({ length: count }, (_, index) => {
    const [min, max, value] = raw.slice(index * 3, index * 3 + 3).map(Number);
    if (
      ![min, max, value].every(Number.isSafeInteger) ||
      min > max ||
      value < min ||
      value > max
    ) {
      throw new Error('Invalid on-chain controls.');
    }
    return { min, max, value };
  });
}

export function initialControlValues(
  tokenId: string | number,
  controls: ControlDefinition[],
  overrides: Record<string, number>,
  chain?: ReturnType<typeof readControlValues>,
) {
  return Object.fromEntries(
    controls.map((control, index) => {
      const min = chain?.[index].min ?? control.minValue;
      const max = chain?.[index].max ?? control.maxValue ?? 255;
      const candidate =
        overrides[`${tokenId}-${index}`] ??
        chain?.[index].value ??
        control.startValue ??
        min;
      const value =
        Number.isSafeInteger(candidate) && candidate >= min && candidate <= max
          ? candidate
          : (chain?.[index].value ?? min);
      return [index, value];
    }),
  );
}

export function changedControlValues(
  values: Record<string, number>,
  chain: ReturnType<typeof readControlValues>,
) {
  const changes = Object.entries(values).filter(([key, value]) => {
    const index = Number(key);
    const lever = chain[index];
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      !lever ||
      !Number.isSafeInteger(value) ||
      value < lever.min ||
      value > lever.max
    ) {
      throw new Error('Control value is outside its on-chain range.');
    }
    return value !== lever.value;
  });
  return {
    leverIds: changes.map(([key]) => BigInt(key)),
    values: changes.map(([, value]) => BigInt(value)),
  };
}

export function ownsControl(wallet?: string, owner?: string) {
  return !!wallet && !!owner && wallet.toLowerCase() === owner.toLowerCase();
}
