// Regenerate Android launcher PNGs from the SVG masters.
// Run from the repo root:  node docs/app-icon/generate-pngs.mjs
import sharp from 'sharp';
import fs from 'fs';

const resRoot = 'android/app/src/main/res/mipmap-';
const densities = [
  { name: 'mdpi', scale: 1 },
  { name: 'hdpi', scale: 1.5 },
  { name: 'xhdpi', scale: 2 },
  { name: 'xxhdpi', scale: 3 },
  { name: 'xxxhdpi', scale: 4 },
];
// Legacy full icon (pre-26): 48dp * scale
const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// Adaptive foreground: 108dp * scale
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const master = fs.readFileSync('docs/app-icon/icon-master.svg', 'utf8');
const fg = fs.readFileSync('docs/app-icon/icon-foreground.svg', 'utf8');

function svgAt(src, size) {
  return src.replace('width="108" height="108"', `width="${size}" height="${size}"`);
}

async function render(src, out, size) {
  await sharp(Buffer.from(svgAt(src, size))).png({ compressionLevel: 9 }).toFile(out);
  console.log('wrote', out, `${size}x${size}`);
}

for (const d of densities) {
  await render(master, `${resRoot}${d.name}/ic_launcher.png`, legacySizes[d.name]);
  await render(master, `${resRoot}${d.name}/ic_launcher_round.png`, legacySizes[d.name]);
  await render(fg, `${resRoot}${d.name}/ic_launcher_foreground.png`, fgSizes[d.name]);
}
console.log('done');
