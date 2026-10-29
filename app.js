// American Gothic - Ebenen-Compositing.
// Hintergrund (bg.jpg) + zwei Figuren (Green-Screen-Stills/Clips, per Canvas gekeyt).
// Idle = Standbild. Reaktion = Animations-Clip, ausgelöst vom Betrachter (MediaPipe).
// Linkes Gesicht steuert die Frau, rechtes den Mann.

const startEl = document.getElementById('start');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const cam = document.getElementById('cam');
const work = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; return c; })();
const wctx = work.getContext('2d', { willReadFrequently: true });
const hmpf = document.getElementById('hmpf');

const CFG = {
  smileTh: 0.40,       // Lächeln-Schwelle (Blendshape 0..1)
  framesTrigger: 4,    // so viele Lächel-Frames am Stück -> Reaktion
  cooldownMs: 3500,    // Pause nach einer Reaktion
  motionTh: 16,        // Fallback-Bewegungsschwelle
};

const FIGS = [
  { who: 'frau', side: 'L', canvas: document.getElementById('frau-canvas'),
    still: 'assets/frau-stern.png', clip: 'assets/anim/frau-stern--d0.mp4' },
  { who: 'mann', side: 'R', canvas: document.getElementById('mann-canvas'),
    still: 'assets/mann-stern.png', clip: 'assets/anim/mann-stern--d0.mp4' },
];

// ---- Chroma-Key: Grün -> transparent, mit Despill ----
function keyDraw(src, ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 90 && g > r * 1.35 && g > b * 1.35) d[i + 3] = 0;         // Grün weg
    else if (g > r * 1.12 && g > b * 1.12) d[i + 1] = Math.round((r + b) / 2); // Despill
  }
  ctx.putImageData(im, 0, 0);
}

// ---- Figuren vorbereiten ----
for (const f of FIGS) {
  f.ctx = f.canvas.getContext('2d', { willReadFrequently: true });
  f.state = 'idle'; f.smile = 0; f.lastReact = 0; f.ready = false;
  f.img = new Image();
  f.img.onload = () => {
    f.canvas.width = f.img.naturalWidth || 1024;
    f.canvas.height = f.img.naturalHeight || 1024;
    keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height);
    f.ready = true;
  };
  f.img.src = f.still;
  f.video = document.createElement('video');
  f.video.muted = true; f.video.playsInline = true; f.video.preload = 'auto';
  f.video.addEventListener('ended', () => endReact(f));
  f.video.addEventListener('error', () => { f.hasClip = false; });
  f.video.addEventListener('loadeddata', () => { f.hasClip = true; });
  f.video.src = f.clip;
}

function react(f) {
  if (f.state !== 'idle' || !f.ready) return;
  if (performance.now() - f.lastReact < CFG.cooldownMs) return;
  if (!f.hasClip) return;                      // kein Clip -> Figur bleibt still
  f.state = 'reacting';
  try { f.video.currentTime = 0; f.video.play().catch(() => {}); } catch {}
  try { hmpf.currentTime = 0; hmpf.play().catch(() => {}); } catch {}
}
function endReact(f) {
  f.state = 'idle';
  f.lastReact = performance.now();
  keyDraw(f.img, f.ctx, f.canvas.width, f.canvas.height);
}

// ---- Render-Loop: reagierende Figuren zeichnen ihre Video-Frames ----
(function renderLoop() {
  for (const f of FIGS) {
    if (f.state === 'reacting' && f.video.readyState >= 2) {
      keyDraw(f.video, f.ctx, f.canvas.width, f.canvas.height);
    }
  }
  requestAnimationFrame(renderLoop);
})();

// ---- Trigger-Zuordnung (linkes Gesicht -> Frau, rechtes -> Mann) ----
function assign(faces) {
  const left = FIGS.find(f => f.side === 'L'), right = FIGS.find(f => f.side === 'R');
  const sorted = [...faces].sort((a, b) => a.x - b.x);
  const map = new Map();
  if (sorted.length >= 2) { map.set(left, sorted[0]); map.set(right, sorted[1]); }
  else if (sorted.length === 1) { map.set(sorted[0].x < 0.5 ? left : right, sorted[0]); }
  for (const f of FIGS) {
    const face = map.get(f);
    if (face && face.smile) { f.smile++; if (f.smile >= CFG.framesTrigger) { react(f); f.smile = 0; } }
    else f.smile = Math.max(0, f.smile - 1);
  }
}

function debug(t) { if (!statusEl.hidden) statusEl.textContent = t; }

// ---- Modus 1: MediaPipe (2 Gesichter + Lächeln) ----
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
      const faces = (res.faceLandmarks ?? []).map((landmarks, i) => {
        const b = {}; for (const c of (res.faceBlendshapes?.[i]?.categories ?? [])) b[c.categoryName] = c.score;
        const x = landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length;
        const smile = (((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2) > CFG.smileTh;
        return { x, smile };
      });
      assign(faces);
      debug(`${faces.length} Gesicht(er) | frau:${FIGS[0].state} mann:${FIGS[1].state}`);
    }
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- Modus 2: Bewegungs-Fallback (löst beide aus) ----
let prevFrame = null;
function startMotion() {
  const loop = () => {
    if (cam.readyState >= 2) {
      wctx.drawImage(cam, 0, 0, work.width, work.height);
      const cur = wctx.getImageData(0, 0, work.width, work.height).data;
      let diff = 0;
      if (prevFrame) { let s = 0; for (let i = 0; i < cur.length; i += 16) s += Math.abs(cur[i] - prevFrame[i]); diff = s / (cur.length / 16); }
      prevFrame = cur;
      if (diff > CFG.motionTh) FIGS.forEach(react);
      debug(`Bewegung (keine Mimik) | diff:${diff.toFixed(1)}`);
    }
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- Modus 3: Demo (keine Kamera) ----
function startDemo() { let i = 0; debug('Demo'); setInterval(() => { react(FIGS[i % 2]); i++; }, 3000); }

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
  if (e.key === 'ArrowLeft') p.x -= 1;
  else if (e.key === 'ArrowRight') p.x += 1;
  else if (e.key === 'ArrowUp') p.y -= 10;
  else if (e.key === 'ArrowDown') p.y += 10;
  else if (e.key === '+' || e.key === '=') p.w += 1;
  else if (e.key === '-') p.w -= 1;
  else return;
  e.preventDefault(); applyPos(); showPos();
});
function showPos() {
  const w = ['frau', 'mann'][sel]; const p = pos[w];
  debug(`POSITION ${w} (p=wechseln) | x:${p.x}% w:${p.w}% y:${p.y}px\nCSS: --${w}-x:${p.x}%; --${w}-w:${p.w}%; --${w}-y:${p.y}px;`);
}
applyPos();
