// Genereer PNG icons vanuit de SVG bron. Eenmalig draaien (of opnieuw als
// het ontwerp verandert): `npm run gen-icons`. Output wordt gecommit, dus
// de Vite build hoeft hier niets mee.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const targets = [
  { src: 'public/icon.svg',             out: 'public/icon-192.png',         width: 192 },
  { src: 'public/icon.svg',             out: 'public/icon-512.png',         width: 512 },
  { src: 'public/apple-touch-icon.svg', out: 'public/apple-touch-icon.png', width: 180 },
];

for (const { src, out, width } of targets) {
  const svg = readFileSync(src, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(out, png);
  console.log(`${out}: ${png.length.toLocaleString()} bytes`);
}
