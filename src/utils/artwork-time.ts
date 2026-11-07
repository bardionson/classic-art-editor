export type ArtworkTimeRule = {
  type: 'SECONDS' | 'MONTH' | 'HOUR_OF_DAY' | 'DAY_OF_MONTH' | 'DAY_OF_YEAR';
  handler:
    | { type: 'MODULO'; max_bound_inclusive: number }
    | { type: 'CUSTOM'; rules: [number, number, number][] };
};

// Metadata stores a fixed offset in seconds, not an IANA timezone.
// Use UTC accessors on the shifted date so the viewer's own timezone cannot
// change the artwork. Do not infer daylight-saving rules from a city label.
export function getTimeStateIndex(
  rule: ArtworkTimeRule,
  now = new Date(),
  utcOffsetSeconds = 0,
): number {
  const date = new Date(now.getTime() + utcOffsetSeconds * 1000);
  const values = {
    SECONDS: Math.floor(now.getTime() / 1000),
    MONTH: date.getUTCMonth(),
    HOUR_OF_DAY: date.getUTCHours(),
    DAY_OF_MONTH: date.getUTCDate() - 1,
    DAY_OF_YEAR:
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        Date.UTC(date.getUTCFullYear(), 0, 0)) /
      86_400_000,
  };
  const value = values[rule.type];
  return rule.handler.type === 'MODULO'
    ? value % (rule.handler.max_bound_inclusive + 1)
    : (rule.handler.rules.find(
        ([min, max]) => value >= min && value <= max,
      )?.[2] ?? 0);
}

function collectTimeRules(node: unknown): ArtworkTimeRule[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(collectTimeRules);
  const states = (
    node as { states?: { time?: ArtworkTimeRule; options?: unknown[] } }
  ).states;
  if (!states) return [];
  return [
    ...(states.time ? [states.time] : []),
    ...collectTimeRules(states.options),
  ];
}

function nextBoundaryDelay(rule: ArtworkTimeRule, now: number, offset: number) {
  const shifted = now + offset * 1000;
  if (rule.type === 'MONTH') {
    const date = new Date(shifted);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - shifted;
  }
  const unit =
    rule.type === 'SECONDS'
      ? 1000
      : rule.type === 'HOUR_OF_DAY'
        ? 3_600_000
        : 86_400_000;
  const clock = rule.type === 'SECONDS' ? now : shifted;
  return unit - (((clock % unit) + unit) % unit);
}

// Only notify when a time rule chooses a different state. Hour boundaries
// that leave a day/night piece unchanged do not refetch layers or RPC data.
// Visibility changes catch up after the browser suspends a background tab.
export function watchArtworkTime(
  layers: unknown,
  utcOffsetSeconds: number,
  onChange: () => void,
  visibilityTarget?: EventTarget,
): () => void {
  const rules = collectTimeRules(layers);
  if (!rules.length) return () => {};
  const signature = () => {
    const now = new Date();
    return rules
      .map((rule) => getTimeStateIndex(rule, now, utcOffsetSeconds))
      .join(',');
  };
  let previous = signature();
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const check = () => {
    if (stopped) return;
    clearTimeout(timer);
    const current = signature();
    if (current !== previous) {
      previous = current;
      onChange();
    }
    const now = Date.now();
    timer = setTimeout(
      check,
      Math.min(
        2_147_483_647,
        ...rules.map((rule) => nextBoundaryDelay(rule, now, utcOffsetSeconds)),
      ),
    );
  };
  check();
  visibilityTarget?.addEventListener('visibilitychange', check);
  return () => {
    stopped = true;
    clearTimeout(timer);
    visibilityTarget?.removeEventListener('visibilitychange', check);
  };
}
