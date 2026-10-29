// American Gothic - Ebenen-Compositing mit mehreren Emotes.
// Hintergrund (bg.jpg) + zwei Figuren (Green-Screen-Stills/Clips, per Canvas gekeyt).
// Idle = Standbild. Je nach Grimasse des Betrachters spielt die Figur einen anderen Clip.
// Linkes Gesicht steuert die Frau, rechtes den Mann.

const startEl = document.getElementById('start');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const cam = document.getElementById('cam');
const work = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; return c; })();
const wctx = work.getContext('2d', { willReadFrequently: true });
const hmpf = document.getElementById('hmpf');

const CFG = {
  framesTrigger: 4,    // so viele Grimassen-Frames am Stück -> Reaktion
  cooldownMs: 3500,    // Pause nach einer Reaktion
  motionTh: 16,        // Fallback-Bewegungsschwelle
};

// Grimasse -> Clip-Suffix (= Treiber-Bewegung). Reihenfolge = Priorität.
// Die Bewegung ist generisch (d0/d3/...), nicht die Grimasse selbst nachgeahmt,
// aber jede Grimasse löst eine eigene Belebung aus.
const EMOTES = [
  { name: 'tongue', suffix: 'd3',  th: 0.25, score: b => b.tongueOut ?? 0 },
  { name: 'shock',  suffix: 'd6',  th: 0.55, score: b => b.jawOpen ?? 0 },
  { name: 'brows',  suffix: 'd13', th: 0.45, score: b => b.browInnerUp ?? 0 },
  { name: 'smile',  suffix: 'd0',  th: 0.40, score: b => ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2 },
];

const FIGS = [
  { who: 'frau', side: 'L', canvas: document.getElementById('frau-canvas'), still: 'assets/frau-stern.png' },
  { who: 'mann', side: 'R', canvas: document.getElementById('mann-canvas'), still: 'assets/mann-stern.png' },
];

// ---- Chroma-Key: Grün -> transparent, mit Despill ----
function keyDraw(src, ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 90 && g > r * 1.35 && g > b * 1.35) d[i + 3] = 0;
    else if (g > r * 1.12 && g > b * 1.12) d[i + 1] = Math.round((r + b) / 2);
  }
  ctx.putImageData(im, 0, 0);
}

// ---- Figuren + Clips vorbereiten ----
for (const f of FIGS) {
  f.ctx = f.canvas.getContext('2d', { willReadFrequently: true });
  f.state = 'idle'; f.lastReact = 0; f.ready = false; f.active = null;
  f.pending = null; f.pendingCount = 0;
  f.img = new Image();
  f.img.onload = () => {
    f.canvas.width = f.img.naturalWidth || 1024;
    f.canvas.height = f.img.naturalHeight || 1024;
    keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height);
    f.ready = true;
  };
  f.img.src = f.still;
  // pro Emote ein Video (fehlt der Clip, wird dieser Emote für die Figur ignoriert)
  f.videos = {};
  for (const e of EMOTES) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.dataset.has = '0';
    v.addEventListener('loadeddata', () => { v.dataset.has = '1'; });
    v.addEventListener('error', () => { v.dataset.has = '0'; });
    v.addEventListener('ended', () => endReact(f));
    v.src = `assets/anim/${f.who}-stern--${e.suffix}.mp4`;
    f.videos[e.name] = v;
  }
}

function react(f, emoteName) {
  if (f.state !== 'idle' || !f.ready) return;
  if (performance.now() - f.lastReact < CFG.cooldownMs) return;
  const v = f.videos[emoteName];
  if (!v || v.dataset.has !== '1') return;      // Clip (noch) nicht da -> ignorieren
  f.state = 'reacting'; f.active = v;
  try { v.currentTime = 0; v.play().catch(() => {}); } catch {}
  try { hmpf.currentTime = 0; hmpf.play().catch(() => {}); } catch {}
}
function endReact(f) {
  f.state = 'idle'; f.active = null; f.lastReact = performance.now();
  keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height);
}

// ---- Render-Loop ----
(function renderLoop() {
  for (const f of FIGS) {
    if (f.state === 'reacting' && f.active && f.active.readyState >= 2) {
      keyDraw(f.active, f.ctx, f.canvas.width, f.canvas.height);
    }
  }
  requestAnimationFrame(renderLoop);
})();

// erkannte Grimasse (Priorität) aus Blendshapes
function grimace(b) { for (const e of EMOTES) if (e.score(b) > e.th) return e.name; return null; }

// Gesicht -> Figur (links=frau, rechts=mann)
function mapFaces(perFace) {
  const left = FIGS.find(f => f.side === 'L'), right = FIGS.find(f => f.side === 'R');
  const sorted = [...perFace].sort((a, b) => a.x - b.x);
  const map = new Map();
  if (sorted.length >= 2) { map.set(left, sorted[0]); map.set(right, sorted[1]); }
  else if (sorted.length === 1) { map.set(sorted[0].x < 0.5 ? left : right, sorted[0]); }
  return map;
}
// Grimasse mit Hysterese auslösen
function trigger(map) {
  for (const f of FIGS) {
    const face = map.get(f);
    const g = face ? face.grimace : null;
    if (g && g === f.pending) { f.pendingCount++; if (f.pendingCount >= CFG.framesTrigger) { react(f, g); f.pendingCount = 0; } }
    else { f.pending = g; f.pendingCount = g ? 1 : 0; }
  }
}

function debug(t) { if (!statusEl.hidden) statusEl.textContent = t; }

// Debug/Hilfe-Text: Legende + Live-Werte pro Figur (* = ueber Schwelle, loest aus)
const LEGEND = 'GRIMASSE -> REAKTION:  Zunge raus = d3   Mund weit auf = d6   Brauen hoch = d13   Laecheln = d0\n(links=Frau, rechts=Mann;  * = ueber Ausloese-Schwelle)';
function debugText(map) {
  const lines = FIGS.map(f => {
    const face = map.get(f);
    if (!face) return `${f.who.toUpperCase().padEnd(5)} [${f.state}]  (kein Gesicht erkannt)`;
    const s = face.scores;
    const vals = EMOTES.map(e => `${e.name}:${s[e.name].toFixed(2)}${s[e.name] > e.th ? '*' : ' '}`).join('  ');
    return `${f.who.toUpperCase().padEnd(5)} [${f.state}]  aktiv: ${face.grimace ?? '-'}\n       ${vals}`;
  });
  return LEGEND + '\n' + lines.join('\n');
}

// ---- Modus 1: MediaPipe (2 Gesichter + Grimassen) ----
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
        const x = landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length;
        const scores = {}; for (const e of EMOTES) scores[e.name] = e.score(b);
        return { x, grimace: grimace(b), scores };
      });
      const map = mapFaces(perFace);
      trigger(map);
      debug(debugText(map));
    }
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- Modus 2: Bewegungs-Fallback (löst smile-Clip aus) ----
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

// ---- Modus 3: Demo ----
function startDemo() { const names = EMOTES.map(e => e.name); let i = 0; debug('Demo'); setInterval(() => { react(FIGS[i % 2], names[(i >> 1) % names.length]); i++; }, 2500); }

// ---- Start ----
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

// ---- Debug + Positions-Justierung ----
const pos = { frau: { x: 1, w: 56, y: 0 }, mann: { x: 0, w: 58, y: 0 } };
let posMode = false, sel = 0;
function applyPos() {
  const r = document.documentElement.style;
  for (const w of ['frau', 'mann']) { r.setProperty(`--${w}-x`, pos[w].x + '%'); r.setProperty(`--${w}-w`, pos[w].w + '%'); r.setProperty(`--${w}-y`, pos[w].y + 'px'); }
}
addEventListener('keydown', (e) => {
  if (e.key === 'd') { statusEl.hidden = !statusEl.hidden; return; }
  if (e.key === 'p') { posMode = !posMode; if (posMode) sel = (sel + 1) % 2; statusEl.hidden = false; showPos(); return; }
  if (!posMode) return;
  const w = ['frau', 'mann'][sel]; const p = pos[w];
  if (e.key === 'ArrowLeft') p.x -= 1; else if (e.key === 'ArrowRight') p.x += 1;
  else if (e.key === 'ArrowUp') p.y -= 10; else if (e.key === 'ArrowDown') p.y += 10;
  else if (e.key === '+' || e.key === '=') p.w += 1; else if (e.key === '-') p.w -= 1; else return;
  e.preventDefault(); applyPos(); showPos();
});
function showPos() { const w = ['frau', 'mann'][sel]; const p = pos[w]; debug(`POSITION ${w} (p=wechseln) | x:${p.x}% w:${p.w}% y:${p.y}px\nCSS: --${w}-x:${p.x}%; --${w}-w:${p.w}%; --${w}-y:${p.y}px;`); }
applyPos();
