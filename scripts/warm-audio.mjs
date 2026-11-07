// Usage: node scripts/warm-audio.mjs --base=https://async.art --token=1597
// Add --blueprints for the recovered Blueprint mixes, or --all for all known audio.
import { readFileSync, writeFileSync } from 'node:fs';
const sources = JSON.parse(
  readFileSync(
    new URL('../src/data/archive-audio-sources.json', import.meta.url),
    'utf8',
  ),
);
const args = process.argv.slice(2);
const option = (name) =>
  args
    .find((v) => v.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const base = option('base') ?? 'https://async.art';
const token = option('token');
if (!token && !args.includes('--blueprints') && !args.includes('--all'))
  throw new Error('Select --token=ID, --blueprints, or --all.');
const selected = Object.entries(sources).filter(
  ([, refs]) =>
    args.includes('--all') ||
    refs.some(
      (r) =>
        (token && r.tokenId === token) ||
        (args.includes('--blueprints') && r.family === 'music-blueprints'),
    ),
);
const result = [];
for (const [path] of selected) {
  try {
    const response = await fetch(
      `${base}/api/audio?path=${encodeURIComponent(path)}`,
      { method: 'POST', signal: AbortSignal.timeout(65000) },
    );
    const data = await response.json();
    const row = { path, status: data.status, http: response.status };
    if (data.status === 'ready') {
      // Test seeking and browser CORS. Do not log or save signed URLs.
      const sample = await fetch(data.url, {
        headers: { Range: 'bytes=0-31', Origin: new URL(base).origin },
        signal: AbortSignal.timeout(15000),
      });
      row.rangeStatus = sample.status;
      row.contentType = sample.headers.get('content-type');
      row.cors = sample.headers.get('access-control-allow-origin');
      row.contentRange = sample.headers.get('content-range');
      await sample.body?.cancel();
    }
    result.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    const row = { path, status: 'request-failed', error: error.name };
    result.push(row);
    console.log(JSON.stringify(row));
  }
}
if (option('report'))
  writeFileSync(option('report'), JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    checked: result.length,
    ready: result.filter((r) => r.status === 'ready').length,
  }),
);
