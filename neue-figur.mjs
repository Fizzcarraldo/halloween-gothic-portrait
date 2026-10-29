// neue-figur.mjs <foto> <name>
// Erzeugt assets/<name>-stern.png: die Person aus dem Foto als American-Gothic-Figur
// auf Chroma-Green (gpt-image-2). Danach mit LivePortrait animieren (siehe anim-Batch).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PHOTO = process.argv[2], NAME = process.argv[3];
if (!PHOTO || !NAME) { console.error('Nutzung: node neue-figur.mjs <foto> <name>'); process.exit(1); }
if (!existsSync(PHOTO)) { console.error('Foto fehlt: ' + PHOTO); process.exit(1); }

const MODEL = 'gpt-image-2';
const QUALITY = 'medium';
const SIZE = '1024x1024';

function loadKey() {
  if (process.env.OPENAI) return process.env.OPENAI;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const p = join(homedir(), 'Projekte/Personal-Assistant/.env');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*OPENAI(?:_API_KEY)?\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}
const KEY = loadKey();
if (!KEY) { console.error('Kein OPENAI-Key.'); process.exit(1); }

const PROMPT = `Turn the person in this photo into a single figure in the style of Grant Wood's "American Gothic" oil painting: a painted, dour, neutral, serious expression, head and upper body, keep the person's recognizable face. Dress them in a 19th-century patterned dress with a white collar in the American Gothic spirit, but with a DIFFERENT colour and pattern than the classic brown dress (clearly different from the other woman). Place the single figure centered on a solid uniform pure chroma-key green (hex #00FF00) background filling the ENTIRE frame edge to edge. No scenery, no house, no second person, only the one figure in front of flat green. Matte oil-painting brushwork, muted earthy palette, dramatic soft light.`;

const fd = new FormData();
fd.append('model', MODEL);
fd.append('image', new Blob([readFileSync(PHOTO)], { type: 'image/jpeg' }), 'photo.jpg');
fd.append('prompt', PROMPT);
fd.append('size', SIZE); fd.append('quality', QUALITY); fd.append('n', '1');
fd.append('background', 'opaque'); fd.append('output_format', 'png');

process.stdout.write(`${NAME} (Figur) ... `);
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd });
const j = await r.json();
if (!r.ok || !j.data?.[0]?.b64_json) { console.error('FEHLER: ' + JSON.stringify(j.error ?? j).slice(0, 300)); process.exit(1); }
writeFileSync(`assets/${NAME}-stern.png`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log(`ok -> assets/${NAME}-stern.png`);
