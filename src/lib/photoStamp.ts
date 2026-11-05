import * as jpeg from 'jpeg-js';

/**
 * Burns a "geo-tag" into a fuel-proof photo: the date and time, the GPS position and the accuracy, on a dark band along the
 * bottom edge. The server does it, with its own clock, so the time on a proof cannot be changed by setting the phone's clock,
 * and it looks the same whatever device took the photo.
 *
 * The text is drawn with a small built-in 5x7 pixel font rather than a font file, because serverless hosts have no system
 * fonts and would silently print nothing.
 */

// Each glyph is 7 rows of 5 columns ('#' = lit).
const GLYPHS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface GeoStamp {
  latitude: number;
  longitude: number;
  /** GPS accuracy in metres, when the phone reported it. */
  accuracy?: number | null;
  /** When the proof was recorded. */
  at: Date;
}

/** "04 NOV 2026  01:10 PM IST": the moment in India time, whatever the server's own time zone. */
export function formatStampTime(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const hour24 = Number(parts['hour']) % 24;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${parts['day']} ${MONTHS[Number(parts['month']) - 1]} ${parts['year']}  ${String(hour12).padStart(2, '0')}:${parts['minute']} ${hour24 < 12 ? 'AM' : 'PM'} IST`;
}

/** The three lines printed on the photo. */
export function stampLines(geo: GeoStamp): string[] {
  const lat = `${Math.abs(geo.latitude).toFixed(5)} ${geo.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(geo.longitude).toFixed(5)} ${geo.longitude >= 0 ? 'E' : 'W'}`;
  const accuracy = geo.accuracy != null ? `  ACC ${Math.round(geo.accuracy)} M` : '';
  return [formatStampTime(geo.at), `LAT ${lat}  LON ${lon}${accuracy}`, 'OASIS FUEL'];
}

function drawText(rgba: Uint8Array, width: number, height: number, text: string, x: number, y: number, scale: number) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? GLYPHS[' ']!;
    for (let row = 0; row < GLYPH_H; row += 1) {
      for (let col = 0; col < GLYPH_W; col += 1) {
        if (glyph[row]![col] !== '#') continue;
        for (let dy = 0; dy < scale; dy += 1) {
          const py = y + row * scale + dy;
          if (py < 0 || py >= height) continue;
          for (let dx = 0; dx < scale; dx += 1) {
            const px = cursor + col * scale + dx;
            if (px < 0 || px >= width) continue;
            const i = (py * width + px) * 4;
            rgba[i] = 255;
            rgba[i + 1] = 255;
            rgba[i + 2] = 255;
            rgba[i + 3] = 255;
          }
        }
      }
    }
    cursor += (GLYPH_W + 1) * scale;
  }
}

/**
 * Returns the JPEG with the geo-tag printed on it. Throws if the image cannot be read; callers should keep the original photo
 * in that case, so a problem with stamping never blocks a fuel entry.
 */
export function stampJpeg(photo: Buffer, geo: GeoStamp): Buffer {
  const image = jpeg.decode(photo, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 30, maxMemoryUsageInMB: 160 });
  const { width, height, data } = image;

  const lines = stampLines(geo);
  const widest = Math.max(...lines.map((line) => line.length));
  // As large as reads well, but never wider than the photo: about 1 pixel of text per 85 of width, at least 2x.
  const fit = Math.floor((width * 0.94) / (widest * (GLYPH_W + 1)));
  const scale = Math.max(1, Math.min(fit, Math.max(2, Math.round(width / 300))));

  const lineHeight = GLYPH_H * scale;
  const gap = Math.max(2, Math.round(scale * 1.5));
  const pad = Math.max(4, scale * 3);
  const bandHeight = Math.min(height, pad * 2 + lines.length * lineHeight + (lines.length - 1) * gap);
  const bandTop = height - bandHeight;

  // Darken the band (65% black) so the white text reads on any photo.
  for (let y = bandTop; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = Math.round(data[i]! * 0.35);
      data[i + 1] = Math.round(data[i + 1]! * 0.35);
      data[i + 2] = Math.round(data[i + 2]! * 0.35);
    }
  }

  lines.forEach((line, index) => {
    drawText(data, width, height, line, pad, bandTop + pad + index * (lineHeight + gap), scale);
  });

  return jpeg.encode({ data, width, height }, 82).data;
}
