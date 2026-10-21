import fs from 'node:fs';
export function nativeContext(file) {
  const fd = fs.openSync(file, 'r'); let position = 0;
  const take = n => { const buffer = Buffer.alloc(n); if (fs.readSync(fd, buffer, 0, n, position) !== n) throw new Error('Truncated GGUF metadata'); position += n; return buffer; };
  const u64 = () => Number(take(8).readBigUInt64LE());
  const string = () => take(u64()).toString('utf8');
  const sizes = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 };
  const value = type => {
    if (type === 8) return string();
    if (type === 9) { const subtype = take(4).readUInt32LE(), count = u64(); if (sizes[subtype]) position += sizes[subtype] * count; else for (let i = 0; i < count; i++) value(subtype); return undefined; }
    const b = take(sizes[type] || 0);
    if (type === 4) return b.readUInt32LE();
    if (type === 10) return Number(b.readBigUInt64LE());
    return undefined;
  };
  try {
    if (take(4).toString() !== 'GGUF') throw new Error('Not a GGUF');
    const version = take(4).readUInt32LE(); if (version !== 3) throw new Error('Unsupported GGUF version: ' + version);
    u64(); const entries = u64(); const metadata = {};
    for (let i = 0; i < entries; i++) {
      const key = string(), item = value(take(4).readUInt32LE());
      if (key === 'general.architecture' || key.endsWith('.context_length') || key === 'general.name') metadata[key] = item;
      const arch = metadata['general.architecture'];
      if (arch && metadata[arch + '.context_length']) return { architecture: arch, nativeContext: metadata[arch + '.context_length'], metadata };
    }
    throw new Error('Native context metadata missing');
  } finally { fs.closeSync(fd); }
}
