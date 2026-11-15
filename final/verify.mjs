import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
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
    if (existsSync(join(root, path))) hashes[path] = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
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
  await call('Network.setCacheDisabled', { cacheDisabled: true });
  await call('Page.navigate', { url: 'http://127.0.0.1:8781/final/?seed=42' });
  await until(() => evaluate("window.finalSystem?.game.state==='menu'"), 'arranque integrado');
  assert.equal(await evaluate("document.getElementById('loading').classList.contains('hidden')"), true);
  await evaluate("window.g=finalSystem.game;window.ui=finalSystem.ui;window.solar=finalSystem.solar;g.beginPlay()");
  await until(() => evaluate("g.state!=='menu'"), 'transición de introducción');
  await until(() => evaluate("!ui.transitionActive"), 'fundido de introducción');
  assert.equal(await evaluate("new URL(document.getElementById('introVideo').src).pathname.endsWith('/completa_intro.mp4')"), true);
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
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#cleaning-task .task-footnotes')).display"), 'none');
  await screenshot('limpieza-panel');
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
  assert.equal(await evaluate("ui.kind"), null, 'sin ventana de confirmación al terminar el panel');
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
  await until(() => evaluate("!ui.transitionActive"), 'cierre visor');
  await evaluate("g.mission.startedAt=performance.now()-180001;g.update(1/60)");
  await until(() => evaluate("ui.kind==='story'"), 'aviso a tres minutos reales');
  assert.equal(await evaluate("g.mission.visorUnlocked"), false);
  await screenshot('aviso');
  await until(() => evaluate("document.getElementById('story-video').readyState>=2"), 'segunda cinemática');
  assert.equal(await evaluate("document.getElementById('story-start')"), null);
  await screenshot('segunda-cinematica');
  await evaluate("document.getElementById('story-video').dispatchEvent(new Event('ended'))");
  await until(() => evaluate("g.mission.visorUnlocked && !ui.transitionActive"), 'salida segunda cinemática');
  await key('ShiftLeft', 'Shift');
  await until(() => evaluate("ui.kind==='story' && !ui.transitionActive"), 'tercera cinemática');
  await until(() => evaluate("document.getElementById('story-video').readyState>=2"), 'radiación');
  await screenshot('radiacion-cinematica');
  await evaluate("document.getElementById('story-video').dispatchEvent(new Event('ended'))");
  await until(() => evaluate("g.mission.turtleMission && !ui.transitionActive"), 'misión Tortuga');
  await evaluate("ui.updateSurvival()");
  assert.equal(await evaluate("document.getElementById('mission-objective').hidden"), false);
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
  assert.equal(await evaluate("g.mission.turtleComplete"), true);
  await until(() => evaluate("!document.getElementById('farewell').hidden && !ui.transitionActive"), 'créditos tras modo Tortuga');
  assert.equal(await evaluate("document.querySelector('#farewell img').getAttribute('src').includes('Pantallla_demo.png')"), true);
  await evaluate("ui.updateSurvival()");
  assert.equal(await evaluate("document.getElementById('mission-objective').hidden"), true);
  assert.equal(await evaluate("g.stationModes.get('principal')"), 'tortuga');
  assert.equal(await evaluate("g.scene.backgroundImage===g.assets.get('final_room_saving')"), true);
  await screenshot('creditos');
  await evaluate("document.getElementById('farewell-close').click()");
  await until(() => evaluate("document.getElementById('farewell').hidden && !ui.transitionActive"), 'cerrar créditos');
  await evaluate("ui.open('electrolysis',g.scene.station.id);document.querySelector('#activity-intro button').click()");
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
  await evaluate("g.collisionsEnabled=false");
  assert.equal(await evaluate(`(()=>{
    const b=g.scene.player.body; b.position.x=192-b.collider.offsetX+.1; b.position.y=280;
    b.velocity.x=-60; const before=g.impacts.count;
    g.scene.physicsWorld.step(1/60);
    return g.impacts.count===before && b.velocity.x<0;
  })()`), true, 'colisiones desactivadas sin eliminar interacciones');
  await evaluate("g.collisionsEnabled=true");
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
  assert.equal(await evaluate("document.getElementById('death-screen-img').getAttribute('src')"), 'assets/Sprites/Astronauta/Pantalla_fallo.png');
  console.log('PASS recarga integral, vida con sprites, puestos alineados, impactos reales y avisos pixelados');
  console.log('PASS Alimentos fijo y persistente, muerte a cinco segundos');

  assert.deepEqual(errors, [], 'sin errores de JavaScript');
  assert.deepEqual(network, [], 'sin archivos HTTP ausentes');
  assert.deepEqual(fingerprints(), before, 'originales intactos');
  console.log('PASS navegador sin excepciones/404 y originales intactos.');
  await evaluate("sessionStorage.setItem('final-language','en');location.reload()");
  await until(() => evaluate("window.finalSystem?.game.state==='menu' && window.finalSystem.game.language==='en'"), 'English menu');
  await until(() => evaluate("document.getElementById('death-screen-img').complete && document.getElementById('death-screen-img').naturalWidth>0"), 'English death artwork');
  assert.equal(await evaluate("document.getElementById('death-screen-img').getAttribute('src')"), 'assets/Sprites/Astronauta/Pantalla_Fallo_Ingles.png');
  assert.equal(await evaluate("finalSystem.game._getMenuButtons()[0].label"), 'START GAME');
  await evaluate(`(()=>{
    const g=finalSystem.game; const btn=g._getMenuButtons()[1];
    g.mouse.x=btn.x+2;g.mouse.y=btn.y+2;g._onPointerAction();
  })()`);
  assert.equal(await evaluate("document.getElementById('settings').hidden"), false);
  assert.equal(await evaluate("document.getElementById('collision-label').textContent"), 'Collisions on');
  await evaluate("document.getElementById('collision-setting').click()");
  assert.equal(await evaluate("finalSystem.game.collisionsEnabled"), false);
  await evaluate("document.getElementById('collision-setting').click();document.getElementById('settings-close').click();finalSystem.game.beginPlay()");
  await until(() => evaluate("finalSystem.game.state==='video' && !finalSystem.ui.transitionActive"), 'English intro video');
  assert.equal(await evaluate("new URL(document.getElementById('introVideo').src).pathname.endsWith('/intro.mp4')"), true);
  await evaluate("document.getElementById('introVideo').dispatchEvent(new Event('ended'))");
  await until(() => evaluate("finalSystem.game.state==='playing' && !finalSystem.ui.transitionActive"), 'English gameplay');
  await until(() => evaluate("document.getElementById('cinematic-timer').textContent.includes('SPACE WEATHER')"), 'English countdown');
  assert.equal(await evaluate("document.getElementById('cinematic-timer').hidden"), false);
  assert.equal(await evaluate("finalSystem.game.mission.remainingAlertSeconds(finalSystem.game.mission.startedAt + 120000)"), 60);
  await screenshot('hud-en');
  assert.equal(await evaluate("document.querySelector('#cleaning-task #task-title').textContent"), 'Cleaning circuit');
  assert.equal(await evaluate("document.querySelector('#help-toggle').textContent"), 'Controls');
  assert.equal(await evaluate("document.getElementById('story').hidden"), true);
  await evaluate("finalSystem.game.scene.openPanel(finalSystem.game.scene.interactables.find(z=>z.name==='Panel solar 1'))");
  assert.equal(await evaluate("finalSystem.ui.cleaning.isOpen"), true);
  await until(() => evaluate("document.getElementById('task-status').textContent.startsWith('Step')"), 'English panel task');
  await evaluate("finalSystem.ui.cleaning.close()");
  await evaluate("finalSystem.game.mission.tick(180,[100]);finalSystem.ui.openStory()");
  assert.equal(await evaluate("finalSystem.game.mission.visorUnlocked"), true);
  assert.equal(await evaluate("document.getElementById('story').hidden"), true);
  await evaluate("document.querySelector('.visor-launcher').click()");
  assert.equal(await evaluate("finalSystem.game.mission.turtleMission"), true);
  assert.equal(await evaluate("document.querySelector('.visor-overlay.language-en .visor-art') !== null"), true);
  await screenshot('visor-en');
  await evaluate("document.querySelector('.visor-close').click();finalSystem.ui.open('food')");
  await until(() => evaluate("!!finalSystem.ui.foodFrame?.contentDocument?.querySelector('#mission-title') && finalSystem.ui.foodFrame.contentDocument.getElementById('loading').hidden"), 'English food');
  await until(() => evaluate("finalSystem.ui.foodFrame.contentDocument.querySelector('label[for=range-blanco]')?.textContent==='White light'"), 'English light controls');
  assert.equal(await evaluate("finalSystem.ui.foodFrame.contentDocument.getElementById('number-rojo').getAttribute('aria-label')"), 'Red light percentage');
  await screenshot('alimentos-en');
  assert.deepEqual((await evaluate(`(()=>{
    const d=finalSystem.ui.foodFrame.contentDocument;
    return [...d.querySelectorAll('h1,h2,h3,p,button,span,option,summary')].filter(e=>/[áéíóúñ¿¡]/i.test(e.textContent) && e.children.length===0).map(e=>e.textContent.trim()).filter(Boolean).slice(0,25);
  })()`)), [], 'food landing contains no Spanish UI');
  await evaluate("finalSystem.ui.foodFrame.contentDocument.getElementById('mission-start').click()");
  assert.deepEqual((await evaluate(`(()=>{
    const d=finalSystem.ui.foodFrame.contentDocument;
    return [...d.querySelectorAll('h1,h2,h3,p,button,span,li,legend,label')].filter(e=>/[áéíóúñ¿¡]/i.test(e.textContent) && e.children.length===0).map(e=>e.textContent.trim()).filter(Boolean).slice(0,25);
  })()`)), [], 'food mission starts without Spanish UI');
  await evaluate("finalSystem.ui.close();finalSystem.ui.open('electrolysis','amarilla')");
  assert.equal(await evaluate("document.getElementById('activity-intro').textContent.includes('La electrólisis')"), false);
  await evaluate("document.querySelector('#activity-intro button').click()");
  await until(() => evaluate("!!finalSystem.ui.currentFrame?.contentWindow?.__ELECTROLISIS__"), 'English electrolysis');
  await until(() => evaluate("finalSystem.ui.currentFrame.contentDocument.querySelector('.fire-text')?.textContent==='FIRE'"), 'English fire button');
  assert.equal(await evaluate("finalSystem.ui.currentFrame.contentDocument.querySelector('#start-button').textContent"), 'START OPERATION');
  assert.equal(await evaluate("finalSystem.ui.currentFrame.contentDocument.querySelector('#cannon-name').textContent"), 'RED CANNON');
  assert.equal(await evaluate("finalSystem.ui.currentFrame.contentDocument.querySelector('#color-banner').textContent.startsWith('RED CANNON')"), true);
  assert.equal(await evaluate("finalSystem.ui.currentFrame.contentWindow.ELECTROLISIS.Renderer.prototype.drawFloaters.toString().includes('translate')"), true);
  await screenshot('electrolisis-en');
  await evaluate("finalSystem.ui.close()");
  await until(() => evaluate("!finalSystem.ui.transitionActive"), 'English electrolysis close');
  await evaluate("(async()=>{const {FinalInterior,STATIONS}=await import('./final/scenes.js');await finalSystem.game.changeScene(new FinalInterior(finalSystem.game,STATIONS[0]));})()");
  await until(() => evaluate("finalSystem.game.scene.isInterior && !finalSystem.game.transitioning"), 'English station');
  await evaluate("finalSystem.game.scene.openOxygen()");
  await until(() => evaluate("finalSystem.game.scene.isRecarga && !!finalSystem.game.scene.minigame && !finalSystem.game.transitioning"), 'English recharge');
  await until(() => evaluate("document.getElementById('recarga-status').textContent.includes('Connect and turn')"), 'English recharge controls');
  assert.equal(await evaluate("document.getElementById('recarga-o2').textContent"), 'Connect O2');
  const rechargeText = await evaluate(`(()=>{
    const ctx=finalSystem.game.renderer.context, original=ctx.fillText, texts=[];
    // Capture the final text passed to Canvas after the integrated-only translation.
    ctx.fillText=function(text,...args){ texts.push(text); return original.call(this,text,...args); };
    finalSystem.game.render(1);
    ctx.fillText=original;
    return texts;
  })()`);
  assert.ok(rechargeText.includes('Drag O2 to blue and CO2 to green.'), JSON.stringify(rechargeText.slice(0, 30)));
  assert.equal(rechargeText.some(text => /Arrastra|Reserva de|Extracción de|Conecta las líneas/.test(text)), false);
  await screenshot('recarga-en');
  await evaluate("finalSystem.game.scene.opts.onCancel()");
  await until(() => evaluate("finalSystem.game.scene.isInterior && !finalSystem.game.transitioning"), 'English recharge close');
  await evaluate("finalSystem.ui.close();finalSystem.ui.open('modes','principal')");
  await until(() => evaluate("!!finalSystem.ui.currentFrame?.contentDocument?.getElementById('btn-tortuga')"), 'English modes');
  await evaluate("finalSystem.ui.currentFrame.contentDocument.getElementById('btn-tortuga').click()");
  assert.deepEqual((await evaluate(`(()=>{
    const d=finalSystem.ui.currentFrame.contentDocument;
    return [...d.querySelectorAll('h1,h2,h3,p,button,span')].filter(e=>/[áéíóúñ¿¡]/i.test(e.textContent) && e.children.length===0).map(e=>e.textContent.trim()).filter(Boolean).slice(0,25);
  })()`)), [], 'Turtle calibration contains no Spanish UI');
  await evaluate("(()=>{const w=finalSystem.ui.currentFrame.contentWindow;w.document.getElementById('modalClose').click();const random=w.Math.random;w.Math.random=()=>0;w.document.getElementById('btn-tortuga').click();w.Math.random=random;})()");
  await until(() => evaluate("!finalSystem.ui.currentFrame?.contentDocument?.querySelector('.seq-btn')?.disabled"), 'English turtle sequence');
  await evaluate("for(let i=0;i<4;i++)finalSystem.ui.currentFrame.contentDocument.querySelector('[data-name=\"escudo\"]').click()");
  await until(() => evaluate("!document.getElementById('farewell').hidden && !finalSystem.ui.transitionActive"), 'English credits');
  await until(() => evaluate("document.querySelector('#farewell img').complete && document.querySelector('#farewell img').naturalWidth>0"), 'English credits artwork');
  assert.equal(await evaluate("document.querySelector('#farewell img').getAttribute('src')"), 'assets/Sprites/Astronauta/Pantallla_demo_ingles.png');
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#farewell img')).display"), 'none');
  await screenshot('creditos-en');
  assert.deepEqual(errors, [], 'English: no JavaScript exceptions');
  assert.deepEqual(network, [], 'English: no missing files');
  console.log('PASS English menu, settings, collisions, intro video and playable final mission.');
  await evaluate("sessionStorage.removeItem('final-language')");
  console.log(`Capturas: ${temp}/final-*.png`);
} finally {
  ws?.close(); chrome.kill(); server.kill();
}
