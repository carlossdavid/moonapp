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
    await delay(750);
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
  assert.equal(await evaluate("Array.from({length:11},(_,i)=>g.assets.has('final_life_'+i)).every(Boolean)"), true);
  assert.equal(await evaluate("!!g.scene.physicsWorld.finalImpactHook"), true);
  assert.equal(await evaluate("document.getElementById('health-bar')"), null, 'vida usa sprites, no progress HTML');
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
  await evaluate("ui.cleaning.close();g.scene.magnetZones.values().next().value.onConfirm()");
  assert.equal(await evaluate("solar.hasMagnet"), true);
  await evaluate("g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 1'));ui.cleaning.connect(0);ui.cleaning.connect(1);ui.cleaning.model.activate()");
  assert.equal(await evaluate("ui.cleaning.model.phase"), 'sweeping');
  // Avanzar el modelo real hasta que sus 24 zonas estén terminadas.
  await evaluate("for(let i=0;i<1000&&!ui.cleaning.model.complete;i++)ui.cleaning.model.tick(.1)");
  assert.equal(await evaluate("ui.cleaning.model.complete"), true);
  await evaluate("ui.cleaning.onCompleted(ui.cleaning.model);ui.cleaning.onFinish(100);ui.cleaning.close()");
  assert.equal(await evaluate("solar.progress.cleanCount"), 1);
  assert.equal(await evaluate("solar.hasMagnet"), false);
  await evaluate("ui.close();g.mission.tick(60,[100]);g.scene.placeMagnet();g.scene.magnetZones.values().next().value.onConfirm();g.scene.openPanel(g.scene.interactables.find(z=>z.name==='Panel solar 2'));ui.cleaning.connect(0);ui.cleaning.connect(1);ui.cleaning.model.activate();for(let i=0;i<1000&&!ui.cleaning.model.complete;i++)ui.cleaning.model.tick(.1);ui.cleaning.onCompleted(ui.cleaning.model);ui.cleaning.close()");
  assert.equal(await evaluate("solar.progress.cleanCount"), 2);
  console.log('PASS limpieza real: descubrimiento, búsqueda, conexiones, barrido, repuesto y persistencia');
  for (const stationId of ['principal', 'verde', 'amarilla']) {
    await evaluate(`(()=>{const z=g.scene.stationDoors.find(item=>item.station.id==='${stationId}').zone;g.scene.player.x=z.x;g.scene.player.y=z.y;})()`);
    await delay(750);
    await key('KeyE', 'e');
    await until(() => evaluate("g.scene.isInterior && !g.transitioning"), 'entrada ' + stationId);
    assert.equal(await evaluate("g.scene.station.id"), stationId);
    assert.deepEqual(await evaluate("g.scene.interiorModules.map(m=>m.id)"), {
      principal: ['recharge', 'console', 'modes'], verde: ['food'], amarilla: ['electrolysis'],
    }[stationId]);
    assert.equal(await evaluate("g.scene.interiorModules.every(m=>m.access.x===m.zone.x&&m.access.y===m.zone.y)"), true);
    if (stationId === 'principal') assert.equal(await evaluate("new Set(g.scene.interiorModules.map(m=>m.y)).size"), 1);
    assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get(g.scene.station.id==='principal'?'final_room_main':'final_room_small')"), true);
    await screenshot(stationId);
    await evaluate("(()=>{const z=g.scene.interactables.find(z=>z.name==='Salida');g.scene.player.x=z.x;g.scene.player.y=z.y;})()");
    await delay(250);
    await key('KeyE', 'e');
    await until(() => evaluate("g.scene.isExterior && !g.transitioning"), 'salida ' + stationId);
  }
  console.log('PASS tres puertas, módulos especializados e interiores diferentes');
  await evaluate("g.scene.enterStation(g.scene.stationDoors[0].station)");
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
  assert.equal(await evaluate("document.getElementById('visor-overlay').hidden"), true);
  await evaluate("g.mission.tick(180,[100]);ui.openStory()");
  assert.equal(await evaluate("ui.kind"), 'story');
  assert.equal(await evaluate("g.mission.visorUnlocked"), false);
  await screenshot('aviso');
  await evaluate("document.getElementById('story-start').click()");
  await until(() => evaluate("document.getElementById('story-video').readyState>=2"), 'segunda cinemática');
  await screenshot('segunda-cinematica');
  await evaluate("document.getElementById('story-exit').click()");
  assert.equal(await evaluate("g.mission.visorUnlocked"), true);
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
  assert.equal(await evaluate("g.stationModes.has('principal')"), false);
  // Resolver la calibración original con una secuencia determinista, sin
  // reemplazar su callback ni inventar un evento de éxito.
  await evaluate("(()=>{const w=ui.currentFrame.contentWindow;const random=w.Math.random;w.Math.random=()=>0;w.document.getElementById('btn-tortuga').click();w.Math.random=random;})()");
  await until(() => evaluate("!ui.currentFrame.contentDocument.querySelector('.seq-btn').disabled"), 'secuencia de calibración');
  await evaluate("for(let i=0;i<4;i++)ui.currentFrame.contentDocument.querySelector('[data-name=\"escudo\"]').click()");
  await until(() => evaluate("g.stationModes.get('principal')==='tortuga'"), 'modo calibrado');
  assert.equal(await evaluate("g.stationModes.get('principal')"), 'tortuga');
  assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get('final_room_saving')"), true);
  await screenshot('modos');
  await evaluate("ui.close();ui.open('electrolysis',g.scene.station.id);document.querySelector('#activity-intro button').click()");
  await until(() => evaluate("!!ui.currentFrame.contentDocument?.querySelector('canvas')"), 'electrólisis');
  assert.equal(await evaluate("ui.kind"), 'electrolysis');
  await screenshot('electrolisis');
  await evaluate("ui.close()");
  console.log('PASS modos por estación y actividad de electrólisis');

  await delay(650);
  await evaluate("g.oxygen.oxigenoTrajeKg=.1;g.energy.energiaTrajeWh=100;g.water.ml=10;g.scene.interiorModules.find(m=>m.id==='recharge').zone.onConfirm()");
  await until(() => evaluate("g.scene.isRecarga && !!g.scene.minigame && !g.transitioning"), 'recarga');
  assert.equal(await evaluate("document.getElementById('recarga-tools').hidden"), false);
  await screenshot('oxigeno');
  await evaluate("g.scene.minigame.conectarLinea('o2');g.scene.minigame.conectarLinea('co2')");
  await delay(2300);
  console.log('Fase oxígeno:', await evaluate("g.scene.minigame.fase"));
  await evaluate("g.scene.minigame.girarValvula('o2');g.scene.minigame.girarValvula('o2');g.scene.minigame.girarValvula('co2');g.scene.minigame.girarValvula('co2')");
  await delay(500);
  assert.ok(await evaluate("g.oxygen.porcentajeTraje>99.9"));
  assert.ok(await evaluate("g.energy.getSnapshot().traje.porcentaje>99.9"));
  assert.equal(await evaluate("g.water.snapshot().ml"), 950);
  assert.equal(await evaluate("ui.kind"), null, 'sin selector de recursos');
  await screenshot('recarga-integral-lista');
  await key('Escape', 'Escape');
  await until(() => evaluate("g.scene.isInterior && !g.transitioning"), 'volver de recarga');
  assert.equal(await evaluate("document.getElementById('recarga-tools').hidden"), true);
  assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get('final_room_saving')"), true);
  console.log('PASS recarga con sprites, conexión al sistema O₂, cierre y modo persistente');

  await evaluate("ui.open('food')");
  await until(() => evaluate("!!ui.foodFrame.contentDocument?.getElementById('mission-start') && ui.foodFrame.contentDocument.getElementById('loading').hidden"), 'alimentos');
  await screenshot('alimentos-modulo');
  assert.equal(await evaluate("ui.foodFrame.contentDocument.documentElement.scrollHeight<=ui.foodFrame.contentWindow.innerHeight"), true);
  await evaluate("ui.foodFrame.contentDocument.getElementById('mission-start').click()");
  await screenshot('alimentos-cultivo');
  await evaluate("ui.close();ui.open('food')");
  assert.equal(await evaluate("ui.foodFrame.contentDocument.getElementById('mission-card').dataset.phase"), 'ajustar');
  await evaluate("g.foodBonus=-50;window.postMessage({type:'alimentos:harvest',crop:'mizuna'},location.origin)");
  await delay(100);
  assert.equal(await evaluate("g.claimedCrops.size"), 0, 'rechaza fuente ajena');
  await evaluate(`(()=>{
    const d=ui.foodFrame.contentDocument;
    for(let round=0;round<3;round++){
      for(const [channel,value] of Object.entries({rojo:81.8,azul:9.1,verde:9.1,blanco:0})){
        const input=d.getElementById('number-'+channel);input.value=value;
        input.dispatchEvent(new ui.foodFrame.contentWindow.Event('input'));
      }
      d.getElementById('apply').click();d.getElementById('mission-next').click();
    }
    d.querySelector('#mission-question input[value=iss]').click();
    d.getElementById('mission-next').click();
  })()`);
  await until(() => evaluate("g.claimedCrops.has('mizuna')"), 'cosecha conectada');
  assert.ok(await evaluate("g.foodLevel>99.9"));
  await screenshot('alimentos-insignia');
  await evaluate("g.foodBonus-=10;ui.foodFrame.contentDocument.getElementById('mission-next').click()");
  assert.ok(await evaluate("g.foodLevel<91"), 'sin premios repetidos');
  await evaluate("ui.close()");
  await delay(700);
  const collision = await evaluate(`(()=>{
    g.stop();
    const player=g.scene.player, body=player.body;
    player.x=192-body.collider.offsetX+.1;player.y=280;
    body.velocity.x=-60;body.velocity.y=0;
    const previous=g.impacts.count,health=g.mission.health;
    g.scene.physicsWorld.step(1/60);g.render(1);
    return {events:g.impacts.count-previous,particles:g.impacts.particles.length,
      velocity:body.velocity.x,healthUnchanged:g.mission.health===health};
  })()`);
  assert.equal(collision.events, 1, 'impacto real contra pared');
  assert.equal(collision.particles, 7);
  assert.ok(collision.velocity > 0, 'retroceso alejándose de la pared');
  assert.equal(collision.healthUnchanged, true);
  await screenshot('impacto');
  await evaluate("document.getElementById('motion-toggle').click()");
  assert.equal(await evaluate("g.impacts.motion"), false);
  await evaluate("g.messages.dismiss();g.messages.tick(0,g,false);ui.notify('Terminal disponible','COMUNICACIONES')");
  assert.ok((await evaluate("getComputedStyle(document.getElementById('notice')).borderImageSource")).includes('pixel-panel.svg'));
  await screenshot('aviso-pixel');
  const pausedTime = await evaluate("g.mission.elapsed");
  await evaluate("ui.transition();g.update(4)");
  assert.equal(await evaluate("g.mission.elapsed"), pausedTime, 'transición pausa la cuenta');
  await delay(700);
  await evaluate("g.stop();g.oxygen.oxigenoTrajeKg=0;for(let i=0;i<299;i++)g.update(1/60)");
  assert.equal(await evaluate("g.mission.dead"), false);
  await evaluate("g.update(1/60)");
  assert.equal(await evaluate("g.mission.dead"), true);
  await screenshot('muerte');
  console.log('PASS recarga integral, vida con sprites, puestos alineados, impactos reales y avisos pixelados');
  console.log('PASS Alimentos fijo y persistente, muerte a cinco segundos');

  assert.deepEqual(errors, [], 'sin errores de JavaScript');
  assert.deepEqual(network, [], 'sin archivos HTTP ausentes');
  assert.deepEqual(fingerprints(), before, 'originales intactos');
  console.log('PASS navegador sin excepciones/404 y originales intactos.');
  console.log(`Capturas: ${temp}/final-*.png`);
} finally {
  ws?.close(); chrome.kill(); server.kill();
}
