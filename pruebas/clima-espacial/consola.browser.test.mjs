import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = process.env.LOCALAPPDATA + '/Temp/opencode';
const server = spawn('python', ['-m', 'http.server', '8777', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--remote-debugging-port=9360',
  '--window-size=1280,900', `--user-data-dir=${temp}/clima-console-test`, 'about:blank',
], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
async function until(fn) {
  for (let i = 0; i < 160; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(100);
  }
  throw new Error('Tiempo agotado');
}
try {
  await until(async () => (await fetch('http://127.0.0.1:8777/')).ok);
  const tab = await until(async () => (await (await fetch('http://localhost:9360/json/list')).json()).find(t => t.type === 'page'));
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const call = (method, params = {}) => new Promise(resolve => {
    const key = ++id; pending.set(key, resolve); ws.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result.result.value;
  };
  await call('Runtime.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:8777/pruebas/clima-espacial/?seed=42' });
  await until(() => evaluate("window.climaTest?.game.state === 'menu' && document.getElementById('chance-flr').textContent !== '—'"));
  assert.equal(await evaluate("document.getElementById('monitor-content').hidden"), true);
  assert.deepEqual(await evaluate("['chance-flr','chance-cme','chance-gst','chance-flr-cme','chance-cme-sep'].map(id=>document.getElementById(id).textContent)"),
    ['19,4 %', '32,3 %', '6,5 %', '25,0 %', '7,1 %']);
  await evaluate("climaTest.game.beginPlay()");
  await until(() => evaluate("climaTest.game.state === 'playing'"));
  assert.ok(await evaluate("(()=>{const c=document.getElementById('game');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4!==3&&v>0)})()"));
  // Fuera de la zona, E no abre la consola.
  const key = async (code, text) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', code, key: text });
    await delay(100);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text });
    await delay(100);
  };
  await key('KeyE', 'e');
  assert.equal(await evaluate("document.getElementById('monitor-content').hidden"), true);
  // Colocar el astronauta junto a la consola y usar el mismo E del jugador.
  await evaluate("(()=>{const g=climaTest.game;const z=g.scene.interactables.find(z=>z.name==='CONSOLA DE CONTROL');g.scene.player.x=z.x;g.scene.player.y=z.y;})()");
  await delay(300);
  await key('KeyE', 'e');
  await until(() => evaluate("!document.getElementById('monitor-content').hidden"));
  assert.equal(await evaluate("document.querySelector('.console-art').naturalWidth > 0"), true);
  const clock = await evaluate("document.getElementById('clock').textContent");
  await delay(1200);
  assert.notEqual(await evaluate("document.getElementById('clock').textContent"), clock);
  assert.equal(await evaluate("document.getElementById('day').textContent"), '1');
  const before = await evaluate("Number(document.getElementById('particle-value').textContent)");
  await evaluate("document.getElementById('test-alert').click()");
  await delay(400);
  assert.ok(await evaluate("Number(document.getElementById('particle-value').textContent)") > before + 30);
  assert.ok(await evaluate("document.getElementById('weather-chart').getContext('2d').getImageData(0,0,400,246).data.some((v,i)=>i%4===3&&v>0)"));
  const screen = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${temp}/clima-console.png`, Buffer.from(screen.result.data, 'base64'));
  await key('Escape', 'Escape');
  assert.equal(await evaluate("document.getElementById('monitor-content').hidden"), true);
  const oldPosition = await evaluate("climaTest.game.scene.player.x");
  await key('KeyD', 'd');
  assert.notEqual(await evaluate("climaTest.game.scene.player.x"), oldPosition);
  assert.deepEqual(errors, []);
  console.log('PASS: juego visible, E por proximidad, sprite, 5 tasas DONKI, reloj normal, curvas y alerta, Escape y movimiento.');
  console.log(`Captura: ${temp}/clima-console.png`);
} finally {
  ws?.close();
  chrome.kill();
  server.kill();
}
