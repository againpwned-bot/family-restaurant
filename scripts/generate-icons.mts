import fs from "node:fs";

import sharp from "sharp";

const BOWL = `
  <path d="M17 6c-2 2.6 2 4.4 0 7M24 4c-2 3 2 5 0 8.5M31 6c-2 2.6 2 4.4 0 7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>
  <path d="M5 21h38a2 2 0 0 1 2 2.2C44 33.6 35 42 24 42S4 33.6 3 23.2A2 2 0 0 1 5 21Z" fill="#fff"/>
  <path d="M15 46h18" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;

const icon = (size: number, scale: number, background: string | null, radius = 0) => {
  const mark = size * scale;
  const offset = (size - mark) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${offset} ${offset}) scale(${mark / 48})">${BOWL}</g></svg>`;
};

const RED = "#b8321a";
const outputs: [string, string][] = [
  ["public/icons/icon-192.png", icon(192, 0.62, RED, 42)],
  ["public/icons/icon-512.png", icon(512, 0.62, RED, 112)],
  ["public/icons/maskable-512.png", icon(512, 0.5, RED)],
  ["public/icons/badge-96.png", icon(96, 0.8, null)],
  ["app/apple-icon.png", icon(180, 0.6, RED)],
];

for (const [file, svg] of outputs) {
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log("wrote", file);
}
fs.writeFileSync("app/icon.svg", icon(64, 0.68, RED, 14));
console.log("wrote app/icon.svg");
