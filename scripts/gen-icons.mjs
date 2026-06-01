// Generates the PWA icons (public/icon-*.png) using only Node.js built-ins
// (zlib, fs). No external dependencies, no design tooling in the pipeline —
// same approach as the Oura sibling's gen-icons.mjs.
//
// The glyph is an upward activity/mountain zigzag polyline in Strava-ish
// orange (#fc4c02) on deep slate (#0f172a), rendered per-pixel as a signed
// distance to the polyline: coverage = smooth falloff of (halfStroke − dist),
// which gives anti-aliased strokes with round joins/caps for free.

import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = u32be(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBytes = u32be(crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcBytes])
}

// The zigzag, in unit coordinates (0..1 of the icon size). Three rising peaks
// ending high-right: reads as both a mountain profile and an effort graph —
// the two things a training archive is about. Kept inside the central 64%
// so the maskable variant's safe zone (80% circle) never clips it.
const POLYLINE = [
  [0.20, 0.70],
  [0.38, 0.44],
  [0.50, 0.58],
  [0.66, 0.34],
  [0.74, 0.44],
  [0.82, 0.30],
]

// Distance from point p to segment ab — the SDF primitive for a stroked path.
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const lenSq = abx * abx + aby * aby
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, (apx * abx + apy * aby) / lenSq))
  const dx = apx - abx * t
  const dy = apy - aby * t
  return Math.sqrt(dx * dx + dy * dy)
}

// Anti-aliased stroke coverage: 1 on the polyline spine, 0 beyond half the
// stroke width, with a ~1.5px smooth edge (distance-field style, like the
// Oura ring's annulus coverage — no supersampling needed).
function zigzagCoverage(x, y, size) {
  const px = x + 0.5
  const py = y + 0.5
  let d = Infinity
  for (let i = 0; i < POLYLINE.length - 1; i++) {
    const [ax, ay] = POLYLINE[i]
    const [bx, by] = POLYLINE[i + 1]
    d = Math.min(d, distToSegment(px, py, ax * size, ay * size, bx * size, by * size))
  }
  const halfStroke = size * 0.045
  const aa = 1.5
  return Math.min(1, Math.max(0, (halfStroke - d) / aa + 1))
}

function makePng(size, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  // compression=0, filter=0, interlace=0 are already 0

  // Build raw scanlines: each row is [filter_byte=0, R, G, B, R, G, B, ...]
  const rowSize = 1 + size * 3
  const raw = Buffer.alloc(rowSize * size)
  for (let y = 0; y < size; y++) {
    const base = y * rowSize
    raw[base] = 0 // filter type: None
    for (let x = 0; x < size; x++) {
      // Blend glyph colour over the slate background by AA coverage.
      const t = zigzagCoverage(x, y, size)
      raw[base + 1 + x * 3] = Math.round(BG_R + (r - BG_R) * t)
      raw[base + 2 + x * 3] = Math.round(BG_G + (g - BG_G) * t)
      raw[base + 3 + x * 3] = Math.round(BG_B + (b - BG_B) * t)
    }
  }

  const idat = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Strava-ish orange #fc4c02 on slate-900 #0f172a background
const R = 0xfc, G = 0x4c, B = 0x02
const BG_R = 15, BG_G = 23, BG_B = 42

for (const size of [192, 512]) {
  const png = makePng(size, R, G, B)
  const path = `public/icon-${size}.png`
  createWriteStream(path).end(png)
  console.log(`wrote ${path} (${size}x${size}, ${png.length} bytes)`)
}

// Maskable variant: the glyph already sits inside the 80% safe zone on a
// full-bleed background, so it's a byte-identical copy — it exists as a
// separate file so a future designed icon can differ.
{
  const png = makePng(512, R, G, B)
  createWriteStream('public/icon-512-maskable.png').end(png)
  console.log('wrote public/icon-512-maskable.png')
}
