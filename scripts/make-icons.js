const fs = require("node:fs");
const zlib = require("node:zlib");

const BOTTLE_H = 180;

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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smooth(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(a, b, t) {
  const k = clamp01(t);
  return [
    lerp(a[0], b[0], k),
    lerp(a[1], b[1], k),
    lerp(a[2], b[2], k),
  ];
}

function halfWidth(y) {
  const t = y / BOTTLE_H;
  if (t < 0.03) return 15.5 * Math.sqrt(1 - (1 - t / 0.03) ** 2);
  if (t < 0.15) return 15.5;
  if (t < 0.2) return lerp(15.5, 8.5, smooth((t - 0.15) / 0.05));
  if (t < 0.4) return 8.5;
  if (t < 0.54) return lerp(8.5, 29, smooth((t - 0.4) / 0.14));
  if (t < 0.92) return 29;
  const u = (t - 0.92) / 0.08;
  return 29 * Math.sqrt(Math.max(0, 1 - u * u));
}

function bottleFill(cx, cy) {
  if (cy < 0 || cy > BOTTLE_H) return null;
  const hw = halfWidth(cy);
  if (Math.abs(cx) > hw) return null;
  const t = cy / BOTTLE_H;
  const edge = hw === 0 ? 1 : Math.abs(cx) / hw;
  if (t < 0.2) {
    let color = mix([246, 239, 230], [176, 136, 68], t / 0.2);
    const spec = Math.exp(-(((cx + hw * 0.32) / (hw * 0.28)) ** 2));
    color = mix(color, [255, 250, 240], spec * 0.5);
    color = mix(color, [92, 68, 34], edge ** 2.4 * 0.62);
    if (t > 0.175) color = mix(color, [62, 44, 24], smooth((t - 0.175) / 0.025));
    return color;
  }
  let color = mix([248, 242, 234], [176, 154, 130], edge * 0.92);
  color = mix(color, [154, 132, 110], Math.max(0, t - 0.45) * 0.45);
  if (t > 0.48 && t < 0.9) {
    const spec = Math.exp(-(((cx + hw * 0.46) / (hw * 0.11)) ** 2));
    const band = smooth((t - 0.5) / 0.08) * (1 - smooth((t - 0.82) / 0.08));
    color = mix(color, [255, 252, 248], spec * 0.5 * band);
  }
  color = mix(color, [112, 90, 72], Math.max(0, edge - 0.62) / 0.38 * 0.4);
  return color;
}

function background(nx, ny) {
  const dist = Math.hypot(nx * 0.86, ny * 0.98);
  let color = mix([58, 30, 36], [7, 4, 5], smooth(dist / 1.08));
  const glow = Math.exp(-(nx * nx) / 0.22 - ((ny + 0.02) ** 2) / 0.42);
  color = mix(color, [132, 96, 58], glow * 0.16);
  return color;
}

function sample(px, py, width, height, layout) {
  const nx = (px / width) * 2 - 1;
  const ny = (py / height) * 2 - 1;
  let color = background(nx * (width / height), ny);
  const scale = layout.bottleHeight / BOTTLE_H;
  const localX = (px - width / 2) / scale;
  const localY = (py - layout.top) / scale;
  const fill = bottleFill(localX, localY);
  if (!fill) {
    const baseY = layout.top + BOTTLE_H * scale;
    const dx = (px - width / 2) / (scale * 26);
    const dy = (py - baseY) / (scale * 5.5);
    const shade = Math.exp(-(dx * dx + dy * dy));
    color = mix(color, [0, 0, 0], shade * 0.38);
    return color;
  }
  return fill;
}

function render(width, height, layout, samples) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const step = 1 / samples;
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const color = sample(x + (sx + 0.5) * step, y + (sy + 0.5) * step, width, height, layout);
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const count = samples * samples;
      const offset = row + 1 + x * 4;
      raw[offset] = Math.round(r / count);
      raw[offset + 1] = Math.round(g / count);
      raw[offset + 2] = Math.round(b / count);
      raw[offset + 3] = 255;
    }
  }
  return raw;
}

function png(raw, width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function iconLayout(size) {
  const bottleHeight = size * 0.66;
  return { bottleHeight, top: (size - bottleHeight) / 2 };
}

function splashLayout(width, height) {
  const bottleHeight = Math.round(width * 0.42);
  return { bottleHeight, top: Math.round(height * 0.36) };
}

function markSvg() {
  const right = [];
  const left = [];
  const steps = 96;
  for (let i = 0; i <= steps; i += 1) {
    const y = (BOTTLE_H * i) / steps;
    const x = halfWidth(y);
    right.push([50 + x, y]);
    left.push([50 - x, y]);
  }
  const foilCut = 0.2 * BOTTLE_H;
  const bandY = 0.186 * BOTTLE_H;
  const bandW = halfWidth(bandY) * 2;
  const glass = right.concat(left.slice().reverse());
  const foil = right.filter((point) => point[1] <= foilCut).concat(
    left.filter((point) => point[1] <= foilCut).reverse(),
  );
  const path = (points) => points.map((point, index) => {
    const cmd = index === 0 ? "M" : "L";
    return cmd + point[0].toFixed(2) + " " + point[1].toFixed(2);
  }).join("") + "Z";
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180" fill="none">',
    "<defs>",
    '<linearGradient id="foil" x1="50" y1="0" x2="50" y2="' + foilCut.toFixed(1) + '" gradientUnits="userSpaceOnUse">',
    '<stop offset="0" stop-color="#f6efe6"/>',
    '<stop offset="0.42" stop-color="#e4c98a"/>',
    '<stop offset="1" stop-color="#a8884e"/>',
    "</linearGradient>",
    '<linearGradient id="glass" x1="18" y1="40" x2="82" y2="150" gradientUnits="userSpaceOnUse">',
    '<stop offset="0" stop-color="#f8f3ec"/>',
    '<stop offset="0.48" stop-color="#e6d5c2"/>',
    '<stop offset="1" stop-color="#b9a48c"/>',
    "</linearGradient>",
    '<clipPath id="glass-clip"><path d="' + path(glass) + '"/></clipPath>',
    "</defs>",
    '<path fill="url(#glass)" d="' + path(glass) + '"/>',
    '<path fill="url(#foil)" d="' + path(foil) + '"/>',
    '<rect x="' + ((50 - bandW / 2).toFixed(2)) + '" y="' + bandY.toFixed(2) + '" width="' + bandW.toFixed(2) + '" height="2.2" rx="1.1" fill="#3e2c18" clip-path="url(#glass-clip)"/>',
    '<ellipse cx="40" cy="118" rx="3.2" ry="26" fill="#fff" opacity="0.28" clip-path="url(#glass-clip)"/>',
    "</svg>",
    "",
  ].join("\n");
}

const splashes = [
  { file: "splash-1170x2532.png", w: 1170, h: 2532 },
  { file: "splash-1179x2556.png", w: 1179, h: 2556 },
  { file: "splash-1206x2622.png", w: 1206, h: 2622 },
  { file: "splash-1290x2796.png", w: 1290, h: 2796 },
  { file: "splash-1125x2436.png", w: 1125, h: 2436 },
];

fs.mkdirSync("icons", { recursive: true });
[192, 512].forEach((size) => {
  const raw = render(size, size, iconLayout(size), 4);
  fs.writeFileSync("icons/icon-" + size + ".png", png(raw, size, size));
  fs.writeFileSync("icons/icon-maskable-" + size + ".png", png(raw, size, size));
});
fs.writeFileSync("icons/apple-touch-icon.png", png(render(180, 180, iconLayout(180), 4), 180, 180));
fs.writeFileSync("icons/mark.svg", markSvg());
splashes.forEach((splash) => {
  const raw = render(splash.w, splash.h, splashLayout(splash.w, splash.h), 2);
  fs.writeFileSync("icons/" + splash.file, png(raw, splash.w, splash.h));
});
