import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
function fingerprints() {
  const hashes = {};
  function visit(path) {
    for (const item of readdirSync(join(root, path), { withFileTypes: true })) {
      const next = join(path, item.name);
      if (item.isDirectory()) visit(next);
      else if (/\.(js|mjs|html|json|css)$/.test(item.name)) hashes[next] = createHash('sha256').update(readFileSync(join(root, next))).digest('hex');
    }
  }
  visit('src'); visit('pruebas');
  for (const path of ['index.html', 'assets/manifest.json', 'oxygen_system.js']) {
    hashes[path] = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
  }
  return hashes;
}
const before = fingerprints();
const temp = process.env.LOCALAPPDATA + '/Temp/opencode';
const server = spawn('python', ['-m', 'http.server', '8781', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--remote-debugging-port=9364',
  '--window-size=1280,900', `--user-data-dir=${temp}/final-verification`, 'about:blank',
], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label = '') {
  for (let i = 0; i < 200; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(100);
  }
  throw new Error(`Tiempo agotado: ${label}`);
}
let ws;
try {
  await until(async () => (await fetch('http://127.0.0.1:8781/')).ok, 'servidor');
  const tab = await until(async () => (await (await fetch('http://localhost:9364/json/list')).json()).find(t => t.type === 'page'), 'Chrome');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let counter = 0;
  const pending = new Map(), errors = [], network = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) network.push(message.params.response.url);
  };
  const call = (method, params = {}) => new Promise(resolve => {
    const id = ++counter; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result.result.value;
  };
  const screenshot = async name => {
    // Esperar a que la nueva escena se haya renderizado tras una transición.
    await delay(250);
    const response = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${temp}/final-${name}.png`, Buffer.from(response.result.data, 'base64'));
  };
  const key = async (code, value = code) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', code, key: value });
    await delay(120);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', code, key: value });
    await delay(120);
  };
  await call('Runtime.enable'); await call('Network.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:8781/final/?seed=42' });
  await until(() => evaluate("window.finalSystem?.game.state==='menu'"), 'arranque integrado');
  assert.equal(await evaluate("document.getElementById('loading').classList.contains('hidden')"), true);
  await evaluate("window.g=finalSystem.game;window.ui=finalSystem.ui;window.solar=finalSystem.solar;g.beginPlay()");
  if (await evaluate("g.state==='video'")) await key('Space', ' ');
  await until(() => evaluate("g.state==='playing'"), 'introducción');
  console.log('PASS menú, introducción y partida');
  assert.equal(await evaluate("g.scene.isExterior"), true);
  assert.deepEqual(await evaluate("g.scene.stationDoors.map(item=>item.station.id)"), ['principal', 'verde', 'amarilla']);
  assert.equal(await evaluate("g.scene.interactables.filter(z=>/^Panel solar/.test(z.name)).length"), 4);
  await screenshot('exterior');

  // Recursos reales una sola vez por paso, sin depender del framerate de Chrome.
  await evaluate("g.stop()");
  const resourceTest = await evaluate(`(()=>{
    const battery=g.energy.energiaTrajeWh, oxygen=g.oxygen.oxigenoTrajeKg, water=g.water.snapshot().ml;
    const hours=g.energy.tiempoHoras;
    for(let i=0;i<60;i++)g.update(1/60);
    return {battery:battery-g.energy.energiaTrajeWh, oxygen:oxygen-g.oxygen.oxigenoTrajeKg,
      water:water-g.water.snapshot().ml,hours:g.energy.tiempoHoras-hours};
  })()`);
  assert.ok(resourceTest.battery > 0);
  assert.ok(Math.abs(resourceTest.oxygen - .012) < 1e-6);
  assert.ok(Math.abs(resourceTest.water - 13.6) < 1e-6);
  assert.ok(Math.abs(resourceTest.hours - .08) < 1e-6);
  await evaluate("g.loop.start()");
  console.log('PASS HUD: batería/agua/O₂, escala única y sin doble consumo');

  await evaluate("g.scene.enterStation(g.scene.stationDoors[0].station)");
  assert.equal(await evaluate("g.scene.isExterior"), true);
  console.log('PASS puertas bloqueadas hasta limpiar 2 paneles');
  await evaluate("g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 1'))");
  assert.equal(await evaluate("ui.cleaning.isOpen && ui.cleaning.model.phase==='discover'"), true);
  await evaluate("ui.cleaning.advanceDiscovery();ui.cleaning.advanceDiscovery();ui.cleaning.advanceDiscovery()");
  assert.equal(await evaluate("solar.magnetQuest"), true);
  await evaluate("ui.cleaning.close();g.scene.magnetZone.onConfirm()");
  assert.equal(await evaluate("solar.hasMagnet"), true);
  await evaluate("g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 1'));ui.cleaning.connect(0);ui.cleaning.connect(1);ui.cleaning.model.activate()");
  assert.equal(await evaluate("ui.cleaning.model.phase"), 'sweeping');
  // Avanzar el modelo real hasta que sus 24 zonas estén terminadas.
  await evaluate("for(let i=0;i<1000&&!ui.cleaning.model.complete;i++)ui.cleaning.model.tick(.1)");
  assert.equal(await evaluate("ui.cleaning.model.complete"), true);
  await evaluate("ui.cleaning.onCompleted(ui.cleaning.model);ui.cleaning.onFinish(100);ui.cleaning.close()");
  assert.equal(await evaluate("solar.progress.cleanCount"), 1);
  assert.equal(await evaluate("solar.hasMagnet"), false);
  await evaluate("g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 2'));ui.cleaning.close();g.scene.magnetZone.onConfirm();g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 2'));ui.cleaning.connect(0);ui.cleaning.connect(1);ui.cleaning.model.activate();for(let i=0;i<1000&&!ui.cleaning.model.complete;i++)ui.cleaning.model.tick(.1);ui.cleaning.onCompleted(ui.cleaning.model);ui.cleaning.close()");
  assert.equal(await evaluate("solar.progress.cleanCount"), 2);
  console.log('PASS limpieza real: descubrimiento, búsqueda, conexiones, barrido, repuesto y persistencia');
  for (const stationId of ['principal', 'verde', 'amarilla']) {
    await evaluate(`(()=>{const z=g.scene.stationDoors.find(item=>item.station.id==='${stationId}').zone;g.scene.player.x=z.x;g.scene.player.y=z.y;})()`);
    await delay(250);
    await key('KeyE', 'e');
    await until(() => evaluate("g.scene.isInterior && !g.transitioning"), 'entrada ' + stationId);
    assert.equal(await evaluate("g.scene.station.id"), stationId);
    assert.equal(await evaluate("g.scene.interiorModules.some(m=>m.id==='food')"), false);
    assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get(g.scene.station.id==='principal'?'final_room_main':'final_room_clear')"), true);
    await screenshot(stationId);
    await evaluate("(()=>{const z=g.scene.interactables.find(z=>z.name==='Salida');g.scene.player.x=z.x;g.scene.player.y=z.y;})()");
    await delay(250);
    await key('KeyE', 'e');
    await until(() => evaluate("g.scene.isExterior && !g.transitioning"), 'salida ' + stationId);
  }
  console.log('PASS tres puertas, interiores iniciales, salida y ausencia de producción de alimentos');
  await evaluate("g.scene.enterStation(g.scene.stationDoors[1].station)");
  await until(() => evaluate("g.scene.isInterior && !g.transitioning"));
  await evaluate("(()=>{const z=g.scene.interactables.find(z=>z.name==='CONSOLA DE CONTROL');g.scene.player.x=z.x;g.scene.player.y=z.y;})()");
  await delay(200);
  await key('KeyE', 'e');
  await until(() => evaluate("!document.getElementById('monitor-content').hidden"));
  const rates = await evaluate("['chance-flr','chance-cme','chance-gst','chance-flr-cme','chance-cme-sep'].map(id=>document.getElementById(id).textContent)");
  assert.deepEqual(rates, ['19,4 %', '32,3 %', '6,5 %', '25,0 %', '7,1 %']);
  const frozenHours = await evaluate("g.energy.tiempoHoras");
  await delay(300);
  assert.equal(await evaluate("g.energy.tiempoHoras"), frozenHours);
  await evaluate("document.getElementById('test-alert').click()");
  await delay(300);
  await screenshot('consola');
  const particles = await evaluate("document.getElementById('particle-value').textContent");
  assert.equal(await evaluate("document.getElementById('visor-particles-value').textContent"), particles + '/100');
  await key('Escape', 'Escape');
  await key('ShiftLeft', 'Shift');
  assert.equal(await evaluate("document.getElementById('visor-overlay').hidden"), false);
  assert.equal(await evaluate("document.querySelector('.visor-art').naturalWidth>0"), true);
  await screenshot('visor');
  await key('Escape', 'Escape');
  console.log('PASS consola DONKI y visor sincronizados con un solo simulador');

  await evaluate("ui.openEnergy(g.scene.station.id)");
  assert.equal(await evaluate("ui.kind"), 'energy');
  await evaluate("ui.close();ui.open('modes',g.scene.station.id)");
  await until(() => evaluate("!!ui.currentFrame.contentDocument?.getElementById('btn-tortuga')"), 'modos');
  // No aceptar mensajes desde otras ventanas, incluso con el mismo origen.
  await evaluate("window.postMessage({type:'energyModeChanged',mode:'turbo'},location.origin)");
  await delay(100);
  assert.equal(await evaluate("g.stationModes.has('verde')"), false);
  // Resolver la calibración original con una secuencia determinista, sin
  // reemplazar su callback ni inventar un evento de éxito.
  await evaluate("(()=>{const w=ui.currentFrame.contentWindow;const random=w.Math.random;w.Math.random=()=>0;w.document.getElementById('btn-tortuga').click();w.Math.random=random;})()");
  await until(() => evaluate("!ui.currentFrame.contentDocument.querySelector('.seq-btn').disabled"), 'secuencia de calibración');
  await evaluate("for(let i=0;i<4;i++)ui.currentFrame.contentDocument.querySelector('[data-name=\"escudo\"]').click()");
  await until(() => evaluate("g.stationModes.get('verde')==='tortuga'"), 'modo calibrado');
  assert.equal(await evaluate("g.stationModes.get('verde')"), 'tortuga');
  assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get('final_room_saving')"), true);
  await screenshot('modos');
  await evaluate("ui.close();ui.open('electrolysis',g.scene.station.id);document.querySelector('#activity-intro button').click()");
  await until(() => evaluate("!!ui.currentFrame.contentDocument?.querySelector('canvas')"), 'electrólisis');
  assert.equal(await evaluate("ui.kind"), 'electrolysis');
  await screenshot('electrolisis');
  await evaluate("ui.close()");
  console.log('PASS modos por estación y actividad de electrólisis');

  await evaluate("g.scene.openOxygen()");
  await until(() => evaluate("g.scene.isRecarga && !!g.scene.minigame && !g.transitioning"), 'recarga');
  assert.equal(await evaluate("document.getElementById('recarga-tools').hidden"), false);
  await screenshot('oxigeno');
  await evaluate("g.scene.minigame.conectarLinea('o2');g.scene.minigame.conectarLinea('co2')");
  await delay(2300);
  console.log('Fase oxígeno:', await evaluate("g.scene.minigame.fase"));
  await evaluate("g.scene.minigame.girarValvula('o2');g.scene.minigame.girarValvula('o2');g.scene.minigame.girarValvula('co2');g.scene.minigame.girarValvula('co2')");
  await delay(500);
  assert.equal(await evaluate("g.oxygenCharging"), true);
  await key('Escape', 'Escape');
  await until(() => evaluate("g.scene.isInterior && !g.transitioning"), 'volver de recarga');
  assert.equal(await evaluate("document.getElementById('recarga-tools').hidden"), true);
  assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get('final_room_saving')"), true);
  console.log('PASS recarga con sprites, conexión al sistema O₂, cierre y modo persistente');

  assert.deepEqual(errors, [], 'sin errores de JavaScript');
  assert.deepEqual(network, [], 'sin archivos HTTP ausentes');
  assert.deepEqual(fingerprints(), before, 'originales intactos');
  console.log('PASS navegador sin excepciones/404 y originales intactos.');
  console.log(`Capturas: ${temp}/final-*.png`);
} finally {
  ws?.close(); chrome.kill(); server.kill();
}
