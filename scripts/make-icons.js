const fs = require("node:fs");
const zlib = require("node:zlib");

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function paint(x, y, size, maskable) {
  const radius = size / 2;
  const nx = (x + 0.5 - radius) / radius;
  const ny = (y + 0.5 - radius) / radius;
  const background = [20, 9, 12, 255];
  if (maskable && Math.hypot(nx, ny) > 0.8) return background;
  const body = (nx * nx) / 0.09 + ((ny - 0.12) * (ny - 0.12)) / 0.28 < 1;
  const neck = Math.abs(nx) < 0.055 && ny < -0.08 && ny > -0.48;
  const foil = Math.abs(nx) < 0.07 && ny < -0.34 && ny > -0.52;
  if (foil) return [212, 180, 131, 255];
  if (body || neck) return [232, 214, 190, 255];
  return background;
}

function png(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = paint(x, y, size, maskable);
      const offset = row + 1 + x * 4;
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync("icons", { recursive: true });
fs.writeFileSync("icons/icon-192.png", png(192, false));
fs.writeFileSync("icons/icon-512.png", png(512, false));
fs.writeFileSync("icons/icon-maskable-192.png", png(192, true));
fs.writeFileSync("icons/icon-maskable-512.png", png(512, true));
