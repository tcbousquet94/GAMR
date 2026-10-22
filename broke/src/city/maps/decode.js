// A baked map ships as gzipped JSON in base64 (tools/bakemap.mjs): a tenth of the page weight of the plain object,
// and nothing is parsed until the map is opened. decodeMap(raw) -> the map object (plain objects pass through).
export async function decodeMap(raw) {
  if (typeof raw !== 'string') return raw;
  if (typeof DecompressionStream !== 'undefined' && typeof atob !== 'undefined') {
    const bin = atob(raw), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }
  const zlib = 'node:zlib', { gunzipSync } = await import(/* @vite-ignore */ zlib);
  return JSON.parse(gunzipSync(Buffer.from(raw, 'base64')).toString('utf8'));
}
