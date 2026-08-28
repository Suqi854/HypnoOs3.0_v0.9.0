import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const out = new URL('../dist/HypnoOS3.0/', import.meta.url);
const outPath = fileURLToPath(out);
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const zipPath = new URL(`../dist/HypnoOS3.0-v${packageJson.version}.zip`, import.meta.url);
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await rm(out, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(out, { recursive: true });
for (const path of ['manifest.json', 'capability-contract.json', 'index.js', 'style.css', 'README.md', 'NOTICE.md', 'LICENSE-PENDING.md', 'docs', 'src', 'ui', 'public']) {
  await cp(new URL(path, root), new URL(path, out), { recursive: true });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
async function collect(dir) {
  const result = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name); const info = await stat(path);
    if (info.isDirectory()) result.push(...await collect(path)); else result.push(path);
  }
  return result;
}
const chunks = []; const central = []; let offset = 0;
for (const path of await collect(outPath)) {
  const name = relative(fileURLToPath(new URL('../dist/', import.meta.url)), path).replaceAll('\\', '/');
  const nameBytes = Buffer.from(name); const data = await readFile(path); const compressed = deflateRawSync(data); const crc = crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  chunks.push(local, nameBytes, compressed);
  const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(8, 10); header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(data.length, 24); header.writeUInt16LE(nameBytes.length, 28); header.writeUInt32LE(offset, 42);
  central.push(header, nameBytes); offset += local.length + nameBytes.length + compressed.length;
}
const centralSize = central.reduce((sum, item) => sum + item.length, 0); const count = central.length / 2;
const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
const stream = createWriteStream(zipPath); for (const chunk of [...chunks, ...central, end]) stream.write(chunk); stream.end(); await new Promise((resolve, reject) => { stream.on('close', resolve); stream.on('error', reject); });
console.log(`Built ${basename(fileURLToPath(zipPath))} with ${count} files`);
