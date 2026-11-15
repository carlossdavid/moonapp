/**
 * Verificación automática de la integración CONTROL DE ENERGÍA.
 *
 * Requisitos: servidor local (`python -m http.server 8765`) y Google Chrome.
 * Uso: node pruebas/integracion-electrolisis/verify.mjs
 *
 * Variables opcionales:
 *   ELECTRO_CHROME  ruta al ejecutable de Chrome
 *   ELECTRO_BASE    URL base (por defecto http://127.0.0.1:8765)
 *   ELECTRO_PORT    puerto de depuración de Chrome (por defecto 9339)
 *   ELECTRO_OUT     carpeta de capturas (por defecto, temporal del sistema)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.ELECTRO_CHROME ||
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.ELECTRO_BASE || 'http://127.0.0.1:8765';
const PAGE = BASE + '/pruebas/integracion-electrolisis/index.html';
const PORT = Number(process.env.ELECTRO_PORT || 9339);
const OUT = process.env.ELECTRO_OUT ||
  path.join(os.tmpdir(), 'electrolisis-integration-shots');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'electro-int-profile-'));

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  '--remote-allow-origins=*',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE,
  '--window-size=1440,900',
  PAGE,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.url.includes('integracion-electrolisis'));
      if (page) return page;
    } catch (e) { /* Chrome aún arrancando */ }
    await sleep(250);
  }
  throw new Error('Chrome no expuso la página de integración');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const errors = [];
const consoleErrors = [];

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push('EXCEPTION ' + JSON.stringify(msg.params.exceptionDetails));
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    errors.push('LOG ' + msg.params.entry.text + ' @ ' + (msg.params.entry.url || ''));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Timeout ' + method));
      }
    }, 20000);
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}

async function waitFor(expression, label, tries = 120) {
  for (let i = 0; i < tries; i += 1) {
    try {
      if (await evaluate(expression)) return true;
    } catch (e) { /* contexto aún cargando */ }
    await sleep(250);
  }
  throw new Error('No se cumplió: ' + label);
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(shot.data, 'base64'));
}

async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function pressKey(key, code, vk) {
  const base = {
    key, code,
    windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  };
  if (key.length === 1) base.text = key;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const pressE = () => pressKey('e', 'KeyE', 69);
const pressEscape = () => pressKey('Escape', 'Escape', 27);

function report(name, value) {
  console.log(name, JSON.stringify(value, null, 2));
}

function center(rect) {
  const w = rect.width ?? rect.w;
  const h = rect.height ?? rect.h;
  return [rect.x + w / 2, rect.y + h / 2];
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

// 1. Carga de la copia del juego original.
await waitFor('!!window.electrolisisIntegration', 'integración cargada');
await waitFor(`window.electrolisisIntegration.state().gameState === 'menu'`, 'menú listo');
await sleep(400);
report('BOOT', await evaluate(`(() => ({
  state: window.electrolisisIntegration.state(),
  loadingHidden: document.getElementById('loading').classList.contains('hidden'),
  introDisplay: getComputedStyle(document.getElementById('introVideo')).display,
  canvas: (() => { const r = document.getElementById('game').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  donki: !!document.querySelector('.donki-monitor'),
  zones: window.electrolisisIntegration.stationZones()
}))()`));
await screenshot('01-menu.png');

// 2. Clic real en INICIAR JUEGO. El original entra en estado video.
const menuPoint = await evaluate(`(() => {
  const g = window.electrolisisIntegration.game;
  const btn = g._getMenuButtons().find((b) => b.id === 'start');
  const r = document.getElementById('game').getBoundingClientRect();
  return [r.x + (btn.x + btn.w / 2) * r.width / 320, r.y + (btn.y + btn.h / 2) * r.height / 180];
})()`);
await click(menuPoint[0], menuPoint[1]);
await waitFor(`window.electrolisisIntegration.state().gameState === 'video'`, 'video de introducción');
report('VIDEO', await evaluate(`(() => ({
  state: window.electrolisisIntegration.state(),
  introDisplay: getComputedStyle(document.getElementById('introVideo')).display,
  paused: document.getElementById('introVideo').paused
}))()`));
await screenshot('02-video.png');

// 3. Saltar la introducción y entrar al interior original.
report('SKIP', await evaluate(`window.electrolisisIntegration.skipIntro()`));
await waitFor(`window.electrolisisIntegration.state().gameState === 'playing'`, 'estado playing');
await sleep(500);
report('PLAYING', await evaluate(`window.electrolisisIntegration.state()`));
await screenshot('03-interior.png');

// 4. Teleportar al jugador a la estación y comprobar el aviso original.
const zone = await evaluate(`window.electrolisisIntegration.stationZones()[0]`);
await evaluate(`window.electrolisisIntegration.teleport(${zone.x}, ${zone.y - zone.h / 2})`);
await sleep(600);
report('STATION', await evaluate(`window.electrolisisIntegration.state()`));

// 5. Abrir con clic sobre la imagen del CENTRO DE ENERGÍA.
const moduleRect = await evaluate(`window.electrolisisIntegration.energyModuleScreenRect()`);
report('MODULE_RECT', moduleRect);
await click(...center(moduleRect));
await waitFor(`window.electrolisisIntegration.state().activityOpen`, 'actividad por clic en imagen');
await sleep(300);
report('OPEN_CLICK', await evaluate(`(() => ({
  state: window.electrolisisIntegration.state(),
  overlayHidden: document.getElementById('activity-overlay').hidden,
  introHidden: document.getElementById('activity-intro').hidden,
  frameHidden: document.getElementById('electrolisis-frame').hidden,
  title: document.querySelector('#activity-title').textContent,
  introScroll: (() => { const e = document.getElementById('activity-intro'); return { client: e.clientHeight, scroll: e.scrollHeight }; })(),
  startRect: (() => { const r = document.getElementById('start-test').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; })(),
  viewport: [window.innerWidth, window.innerHeight]
}))()`));
await screenshot('04-explanation.png');

// 6. Cerrar con Escape y reabrir con la tecla E en la zona original.
await pressEscape();
await waitFor(`!window.electrolisisIntegration.state().activityOpen`, 'cierre con Escape');
await sleep(250);
await pressE();
await waitFor(`window.electrolisisIntegration.state().activityOpen`, 'actividad con tecla E');
report('OPEN_KEY', await evaluate(`window.electrolisisIntegration.state()`));

// 7. Iniciar la prueba embebida.
await click(...center(await evaluate(`(() => {
  const r = document.getElementById('start-test').getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
})()`)));
await waitFor(`(() => {
  const f = document.getElementById('electrolisis-frame');
  return !!(f && f.contentWindow && f.contentWindow.__ELECTROLISIS__ && f.contentWindow.__ELECTROLISIS__.game);
})()`, 'minijuego embebido cargado');
await waitFor(`document.getElementById('electrolisis-frame').contentWindow.__ELECTROLISIS__.state().state === 'playing'`, 'minijuego en marcha');
await sleep(600);
report('EMBED', await evaluate(`(() => {
  const f = document.getElementById('electrolisis-frame');
  const d = f.contentWindow.__ELECTROLISIS__;
  return {
    embed: d.embed,
    state: d.state(),
    startHidden: f.contentDocument.getElementById('start-screen').classList.contains('is-hidden'),
    exitVisible: !f.contentDocument.getElementById('embed-exit').classList.contains('is-hidden'),
    returnHidden: f.contentDocument.getElementById('return-button').classList.contains('is-hidden'),
    frame: (() => { const r = f.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()
  };
})()`));

// 8. Colores reales de las hojas teñidas en tiempo de ejecución.
report('TINTS', await evaluate(`(() => {
  const d = document.getElementById('electrolisis-frame').contentWindow.__ELECTROLISIS__;
  const sample = (canvas) => {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 90) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
    }
    return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), n } : null;
  };
  return { o2: sample(d.renderer.tints.atomsO2), h2: sample(d.renderer.tints.atomsH2) };
})()`));
await screenshot('05-minigame.png');

// 9. Acierto determinista dentro del iframe.
report('HIT', await evaluate(`(async () => {
  const d = document.getElementById('electrolisis-frame').contentWindow.__ELECTROLISIS__;
  const g = d.game;
  const want = g.color === 'red' ? 'O2' : 'H2';
  const atom = g.atoms.find((a) => a.type === want);
  if (!atom) return { skipped: true };
  g.atoms = [atom];
  atom.x = 440; atom.y = 300;
  atom.vx = 0; atom.vy = 0;
  const before = { ...g.stats };
  g.fireAt(atom.x, atom.y);
  await new Promise((r) => setTimeout(r, 700));
  return { before, after: { ...g.stats }, color: g.color, want };
})()`));
await screenshot('06-hit.png');

// 10. Final de ronda y pantalla de informe.
await evaluate(`(() => {
  const d = document.getElementById('electrolisis-frame').contentWindow.__ELECTROLISIS__;
  d.game.timeLeft = 0.02;
})()`);
await waitFor(`document.getElementById('electrolisis-frame').contentWindow.__ELECTROLISIS__.state().state === 'over'`, 'fin de ronda');
await sleep(400);
report('END', await evaluate(`(() => {
  const f = document.getElementById('electrolisis-frame');
  const doc = f.contentDocument;
  return {
    state: f.contentWindow.__ELECTROLISIS__.state(),
    endVisible: !doc.getElementById('end-screen').classList.contains('is-hidden'),
    returnVisible: !doc.getElementById('return-button').classList.contains('is-hidden'),
    title: doc.querySelector('.end-panel .screen-title').textContent,
    rank: doc.getElementById('end-rank').textContent,
    energy: doc.getElementById('end-energy').textContent
  };
})()`));
await screenshot('07-end.png');

// 11. Volver a la estación con el botón del informe.
await evaluate(`document.getElementById('electrolisis-frame').contentDocument.getElementById('return-button').click()`);
await waitFor(`!window.electrolisisIntegration.state().activityOpen`, 'cierre desde el minijuego');
await sleep(400);
report('RETURN', await evaluate(`(() => ({
  state: window.electrolisisIntegration.state(),
  overlayHidden: document.getElementById('activity-overlay').hidden,
  toastHidden: document.getElementById('toast').hidden,
  toast: document.getElementById('toast').textContent
}))()`));
await screenshot('08-toast.png');

// 12. Reabrir y cancelar sin jugar.
await evaluate(`window.electrolisisIntegration.openStation()`);
await sleep(300);
await evaluate(`document.getElementById('cancel-activity').click()`);
await sleep(300);
report('CANCEL', await evaluate(`(() => ({
  state: window.electrolisisIntegration.state(),
  overlayHidden: document.getElementById('activity-overlay').hidden
}))()`));

// 13. Vista móvil de la explicación.
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});
await sleep(400);
await evaluate(`window.electrolisisIntegration.openStation()`);
await sleep(400);
report('MOBILE', await evaluate(`(() => ({
  viewport: [window.innerWidth, window.innerHeight],
  overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  card: (() => { const r = document.querySelector('.activity-card').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  introScroll: (() => { const e = document.getElementById('activity-intro'); return { client: e.clientHeight, scroll: e.scrollHeight }; })(),
  startRect: (() => { const r = document.getElementById('start-test').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; })()
}))()`));
await screenshot('09-mobile.png');
await evaluate(`window.electrolisisIntegration.closeActivity()`);

console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
console.log('ERRORS', JSON.stringify(errors));
console.log('SHOTS', OUT);

ws.close();
chrome.kill();
await sleep(300);
process.exit(errors.length || consoleErrors.length ? 1 : 0);
