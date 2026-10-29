// American Gothic - Ebenen-Compositing mit mehreren Emotes.
// Hintergrund (bg.jpg) + zwei Figuren (Green-Screen-Stills/Clips, per Canvas gekeyt).
// Idle = Standbild. Je nach Grimasse des Betrachters spielt die Figur einen anderen Clip.
// Personen wählbar (Dropdowns), Positionen per Drag & Drop (Einstellungen-Panel, Zahnrad).

const startEl = document.getElementById('start');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const stage = document.getElementById('stage');
const painting = document.getElementById('painting');
const cam = document.getElementById('cam');
const work = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; return c; })();
const wctx = work.getContext('2d', { willReadFrequently: true });
const hmpf = document.getElementById('hmpf');

const CFG = {
  framesTrigger: 4, cooldownMs: 3500, motionTh: 16, maxReactMs: 2600,
};

const EMOTES = [
  { name: 'wink',  suffix: 'd3',    th: 0.30, score: b => { const l = b.eyeBlinkLeft ?? 0, r = b.eyeBlinkRight ?? 0; return Math.max(l, r) > 0.5 ? Math.abs(l - r) : 0; } },
  { name: 'kiss',  suffix: 'd6',    th: 0.45, score: b => b.mouthPucker ?? 0 },
  { name: 'angry', suffix: 'angry', th: 0.40, score: b => ((b.browDownLeft ?? 0) + (b.browDownRight ?? 0)) / 2 },
  { name: 'smile', suffix: 'd0',    th: 0.40, score: b => ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2 },
];

// who bestimmt alle Assets: assets/<who>-stern.png + assets/anim/<who>-stern--<clip>.mp4
const FIGS = [
  { who: 'frau',  side: 'L', slot: 'frau', canvas: document.getElementById('frau-canvas') },
  { who: 'mann',  side: 'R', slot: 'mann', canvas: document.getElementById('mann-canvas') },
];

// Pool wählbarer Personen (neue Gäste hier eintragen)
const PEOPLE = ['frau', 'mann', 'tammy'];

// gespeicherte Einstellungen (Personen + Positionen)
const SETTINGS = (() => { try { return JSON.parse(localStorage.getItem('gothic-settings') || '{}'); } catch { return {}; } })();
if (PEOPLE.includes(SETTINGS.left)) FIGS[0].who = SETTINGS.left;
if (PEOPLE.includes(SETTINGS.right)) FIGS[1].who = SETTINGS.right;
const pos = SETTINGS.pos || { frau: { x: 1, w: 56, y: 0 }, mann: { x: 0, w: 58, y: 0 } };
function saveSettings() { try { localStorage.setItem('gothic-settings', JSON.stringify({ left: FIGS[0].who, right: FIGS[1].who, pos })); } catch {} }

// ---- Chroma-Key: Grün -> transparent, mit Despill ----
function keyDraw(src, ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], avg = (r + b) / 2;
    if (g > 90 && g > r * 1.3 && g > b * 1.3) d[i + 3] = 0;
    else if (g > avg) d[i + 1] = avg;
  }
  ctx.putImageData(im, 0, 0);
}

// ---- Figur laden (kann die Person zur Laufzeit wechseln) ----
function loadFigure(f) {
  f.state = 'idle'; f.lastReact = 0; f.ready = false; f.active = null; f.pending = null; f.pendingCount = 0;
  f.ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
  f.img = new Image();
  f.img.onload = () => {
    f.canvas.width = f.img.naturalWidth || 1024;
    f.canvas.height = f.img.naturalHeight || 1024;
    keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height);
    f.ready = true;
  };
  f.img.src = `assets/${f.who}-stern.png`;
  f.videos = {};
  for (const e of EMOTES) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.dataset.has = '0';
    v.addEventListener('loadeddata', () => { v.dataset.has = '1'; });
    v.addEventListener('error', () => { v.dataset.has = '0'; });
    v.addEventListener('ended', () => endReact(f));
    v.src = `assets/anim/${f.who}-stern--${e.suffix}.mp4`;
    f.videos[e.name] = v;
  }
}
for (const f of FIGS) { f.ctx = f.canvas.getContext('2d', { willReadFrequently: true }); loadFigure(f); }

function react(f, emoteName) {
  if (f.state !== 'idle' || !f.ready) return;
  if (performance.now() - f.lastReact < CFG.cooldownMs) return;
  const v = f.videos[emoteName];
  if (!v || v.dataset.has !== '1') return;
  f.state = 'reacting'; f.active = v; f.reactStart = performance.now();
  try { v.currentTime = 0; v.play().catch(() => {}); } catch {}
  try { hmpf.currentTime = 0; hmpf.play().catch(() => {}); } catch {}
}
function endReact(f) { f.state = 'idle'; f.active = null; f.lastReact = performance.now(); keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height); }

(function renderLoop() {
  for (const f of FIGS) {
    if (f.state !== 'reacting') continue;
    if (performance.now() - f.reactStart > CFG.maxReactMs) { try { f.active && f.active.pause(); } catch {} endReact(f); continue; }
    if (f.active && f.active.readyState >= 2) keyDraw(f.active, f.ctx, f.canvas.width, f.canvas.height);
  }
  requestAnimationFrame(renderLoop);
})();

function grimace(b) { for (const e of EMOTES) if (e.score(b) > e.th) return e.name; return null; }

function mapFaces(perFace) {
  const left = FIGS.find(f => f.side === 'L'), right = FIGS.find(f => f.side === 'R');
  const sorted = [...perFace].sort((a, b) => a.x - b.x);
  const map = new Map();
  if (sorted.length >= 2) { map.set(left, sorted[0]); map.set(right, sorted[1]); }
  else if (sorted.length === 1) { map.set(sorted[0].x < 0.5 ? left : right, sorted[0]); }
  return map;
}
function trigger(map) {
  for (const f of FIGS) {
    const face = map.get(f);
    const g = face ? face.grimace : null;
    if (g && g === f.pending) { f.pendingCount++; if (f.pendingCount >= CFG.framesTrigger) { react(f, g); f.pendingCount = 0; } }
    else { f.pending = g; f.pendingCount = g ? 1 : 0; }
  }
}

function debug(t) { if (!statusEl.hidden) statusEl.textContent = t; }
function debugText(map) {
  const lines = FIGS.map(f => {
    const face = map.get(f);
    const head = `${f.who.toUpperCase().padEnd(5)}[${f.state}]  erkannt: ${face && face.grimace ? face.grimace.toUpperCase() : '-'}`;
    if (!face) return head + '  (kein Gesicht)';
    const rows = EMOTES.map(e => {
      const v = Math.round((face.scores[e.name] ?? 0) * 100), th = Math.round(e.th * 100);
      const mark = face.grimace === e.name ? '  <<< TRIGGER' : (v > th ? '  > ueber Schwelle' : '');
      return `   ${e.name.padEnd(7)} ${String(v).padStart(3)}%   (Schwelle ${String(th).padStart(3)}%)${mark}`;
    });
    return head + '\n' + rows.join('\n');
  });
  return 'GRIMASSE -> CLIP:  Laecheln=d0  Kussmund=d6  Zwinkern=d3  Boese=angry   (links/rechts = Figur)\n' + lines.join('\n');
}

async function tryMediaPipe() {
  const url = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const { FaceLandmarker, FilesetResolver } = await import(`${url}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${url}/wasm`);
  const lm = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
    outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 2,
  });
  const loop = () => {
    if (cam.readyState >= 2) {
      const res = lm.detectForVideo(cam, performance.now());
      const perFace = (res.faceLandmarks ?? []).map((landmarks, i) => {
        const b = {}; for (const c of (res.faceBlendshapes?.[i]?.categories ?? [])) b[c.categoryName] = c.score;
        const x = 1 - landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length; // Kamera spiegeln (Selfie): links steuert links
        const scores = {}; for (const e of EMOTES) scores[e.name] = e.score(b);
        return { x, grimace: grimace(b), scores };
      });
      const map = mapFaces(perFace); trigger(map); debug(debugText(map));
    }
    requestAnimationFrame(loop);
  };
  loop();
}

let prevFrame = null;
function startMotion() {
  const loop = () => {
    if (cam.readyState >= 2) {
      wctx.drawImage(cam, 0, 0, work.width, work.height);
      const cur = wctx.getImageData(0, 0, work.width, work.height).data;
      let diff = 0;
      if (prevFrame) { let s = 0; for (let i = 0; i < cur.length; i += 16) s += Math.abs(cur[i] - prevFrame[i]); diff = s / (cur.length / 16); }
      prevFrame = cur;
      if (diff > CFG.motionTh) FIGS.forEach(f => react(f, 'smile'));
      debug(`Bewegung (keine Mimik) | diff:${diff.toFixed(1)}`);
    }
    requestAnimationFrame(loop);
  };
  loop();
}
function startDemo() { const names = EMOTES.map(e => e.name); let i = 0; debug('Demo'); setInterval(() => { react(FIGS[i % 2], names[(i >> 1) % names.length]); i++; }, 2500); }

async function begin() {
  startEl.classList.add('hidden');
  try { hmpf.play().then(() => { hmpf.pause(); hmpf.currentTime = 0; }).catch(() => {}); } catch {}
  let stream = null;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false }); }
  catch (e) { console.warn('keine Kamera', e); startDemo(); return; }
  cam.srcObject = stream; await cam.play().catch(() => {});
  try { await tryMediaPipe(); } catch (e) { console.warn('MediaPipe fehlt, Bewegungs-Fallback', e); startMotion(); }
}
startBtn.addEventListener('click', begin);

// ---- Positionen (CSS-Variablen) ----
function applyPos() {
  const r = document.documentElement.style;
  for (const w of ['frau', 'mann']) { r.setProperty(`--${w}-x`, pos[w].x + '%'); r.setProperty(`--${w}-w`, pos[w].w + '%'); r.setProperty(`--${w}-y`, pos[w].y + 'px'); }
}
applyPos();

// ---- Einstellungen-Panel: Personen-Auswahl + Drag&Drop-Positionierung ----
const panel = document.getElementById('panel');
const gear = document.getElementById('gear');
const selLeft = document.getElementById('sel-left');
const selRight = document.getElementById('sel-right');
const editChk = document.getElementById('edit-chk');

let editMode = false;
function fillSelect(sel, who) {
  if (!sel) return;
  sel.innerHTML = PEOPLE.map(p => `<option value="${p}"${p === who ? ' selected' : ''}>${p}</option>`).join('');
}
fillSelect(selLeft, FIGS[0].who);
fillSelect(selRight, FIGS[1].who);
// Figur-Wechsel mit Slide: alte faehrt zur eigenen Seite raus, neue faehrt rein
function swapFigure(f, newWho) {
  if (f.who === newWho) return;
  const out = f.slot === 'frau' ? '-150%' : '150%';
  const root = document.documentElement.style;
  root.setProperty(`--${f.slot}-slide`, out);                 // raus
  setTimeout(() => {
    f.who = newWho; loadFigure(f); saveSettings();            // Inhalt tauschen (ist ausserhalb)
    requestAnimationFrame(() => root.setProperty(`--${f.slot}-slide`, '0%')); // rein
  }, 480);
}
selLeft && selLeft.addEventListener('change', () => swapFigure(FIGS[0], selLeft.value));
selRight && selRight.addEventListener('change', () => swapFigure(FIGS[1], selRight.value));
gear && panel && gear.addEventListener('click', () => { panel.hidden = !panel.hidden; });
editChk && editChk.addEventListener('change', () => { editMode = editChk.checked; stage.classList.toggle('editing', editMode); });

// Drag & Mausrad pro Figur
let drag = null;
const DRAG_START = 8; // px Totzone: ein Tipp/Klick verschiebt die Figur nicht, nur bewusstes Ziehen
for (const f of FIGS) {
  f.canvas.addEventListener('pointerdown', (e) => {
    if (!editMode) return;
    drag = { f, px: e.clientX, py: e.clientY, x0: pos[f.slot].x, y0: pos[f.slot].y, active: false, pid: e.pointerId };
  });
  f.canvas.addEventListener('wheel', (e) => {
    if (!editMode) return; e.preventDefault();
    pos[f.slot].w = Math.max(10, pos[f.slot].w + (e.deltaY < 0 ? 1 : -1));
    applyPos(); saveSettings();
  }, { passive: false });
}
addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < DRAG_START) return; // noch in der Totzone
    drag.active = true;                       // jetzt wird es ein echter Zug
    try { drag.f.canvas.setPointerCapture(drag.pid); } catch {}
  }
  e.preventDefault();
  const sw = (painting && painting.clientWidth) || stage.clientWidth || 1;
  const dxPct = (e.clientX - drag.px) / sw * 100;
  const p = pos[drag.f.slot];
  p.x = Math.round(drag.x0 + (drag.f.slot === 'frau' ? dxPct : -dxPct));
  p.y = Math.round(drag.y0 + (e.clientY - drag.py));
  applyPos();
});
addEventListener('pointerup', () => { if (drag) { if (drag.active) saveSettings(); drag = null; } });

// Debug-Zeile mit "d"
addEventListener('keydown', (e) => { if (e.key === 'd') statusEl.hidden = !statusEl.hidden; });
