import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
function firmas() {
  const result = {};
  function walk(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const name = join(path, entry.name);
      if (entry.isDirectory()) walk(name);
      else result[name] = createHash('sha256').update(readFileSync(join(root, name))).digest('hex');
    }
  }
  for (const path of ['final', 'src', 'pruebas/Alimentos/Sprites']) walk(path);
  for (const path of ['index.html', 'pruebas/Alimentos/referenciaINterfaz.jpeg']) {
    result[path] = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
  }
  return result;
}
const before = firmas();
const temp = process.env.LOCALAPPDATA + '/Temp/opencode';
const server = spawn('python', ['-m', 'http.server', '8785', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--remote-debugging-port=9368',
  '--window-size=1600,1050', `--user-data-dir=${temp}/alimentos-verification`, 'about:blank',
], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 180; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(100);
  }
  throw new Error(`Tiempo agotado: ${label}`);
}
let ws;
try {
  await until(async () => (await fetch('http://127.0.0.1:8785/')).ok, 'servidor');
  const tab = await until(async () => (await (await fetch('http://localhost:9368/json/list')).json()).find(t => t.type === 'page'), 'Chrome');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let n = 0;
  const pending = new Map(), errors = [], missing = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) missing.push(message.params.response.url);
  };
  const call = (method, params = {}) => new Promise(resolve => {
    const id = ++n; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async expression => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result.result.value;
  };
  const screenshot = async name => {
    await delay(150);
    const response = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(`${temp}/alimentos-${name}.png`, Buffer.from(response.result.data, 'base64'));
  };
  await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await call('Page.navigate', { url: 'http://127.0.0.1:8785/pruebas/Alimentos/' });
  await until(() => ev("!!window.alimentosTest && document.getElementById('loading').hidden"), 'carga de sprites');
  await until(() => ev("[...document.images].every(img=>img.complete&&img.naturalWidth>0)"), 'imágenes de interfaz');
  assert.ok(await ev("document.documentElement.scrollWidth<=innerWidth+1"), 'sin desbordamiento horizontal en escritorio');
  await ev("document.querySelector('button[data-screen=crop]').click()");
  const configs = {
    mizuna: [[81.8, 9.1, 9.1, 0], ['22,2–23,4 °C', '70,4–91,9 %', '2009–3011 ppm']],
    tomate: [[90, 10, 0, 0], Array(3).fill('Sin dato numérico confirmado')],
    chile: [[27, 40, 33, 0], ['≈ 23 °C', '50 %', '550 ppm']],
    lechuga: [[75, 18.75, 6.25, 0], ['22,2–23,3 °C', '38,3–43,9 %', '2559–2799 ppm']],
    papa: [[0, 0, 0, 100], Array(3).fill('Sin dato numérico confirmado')],
    trigo: [[0, 0, 0, 100], Array(3).fill('Sin dato numérico confirmado')],
  };
  const checksums = new Set();
  for (const [id, [luz, ambiente]] of Object.entries(configs)) {
    await ev(`document.querySelector('.crop-button[data-crop="${id}"]').click()`);
    assert.deepEqual(await ev("['rojo','azul','verde','blanco'].map(c=>Number(document.getElementById('number-'+c).value))"), luz);
    assert.deepEqual(await ev("['temperature','humidity','co2'].map(c=>document.getElementById('env-'+c).textContent)"), ambiente);
    assert.equal(await ev("document.getElementById('chamber').dataset.crop"), id);
    assert.equal(await ev("document.getElementById('chamber').dataset.background"), `fondos/nativo/fondo_camara_${id}.png`);
    assert.equal(await ev("document.querySelectorAll('.crop-button[aria-pressed=true]').length"), 1);
    assert.equal(await ev("document.getElementById('crop-status').textContent"), 'Luz de referencia');
    checksums.add(await ev("(()=>{const d=document.getElementById('chamber').getContext('2d').getImageData(0,0,256,224).data;let s=0;for(let i=0;i<d.length;i++)s=(s+(i%997+1)*d[i])%2147483647;return s;})()"));
    await screenshot(id);
  }
  assert.equal(checksums.size, 6, 'los seis escenarios tienen imágenes distintas');
  console.log('PASS seis cultivos: escenarios, plantas, condiciones y mezclas exactas, trigo 100 % blanca.');
  await ev("document.getElementById('crop-select').value='lechuga';document.getElementById('crop-select').dispatchEvent(new Event('change'))");
  assert.equal(await ev("document.getElementById('number-azul').value"), '18.75');
  await ev("document.querySelector('button[data-screen=crop]').click()");
  await delay(250);
  const rect = await ev("(()=>{const r=document.getElementById('range-rojo').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()");
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.w * .75, y: rect.y + rect.h / 2 });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x + rect.w * .75, y: rect.y + rect.h / 2, button: 'left', buttons: 1, clickCount: 1 });
  await delay(100);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.w - 2, y: rect.y + rect.h / 2, buttons: 1 });
  await delay(100);
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + rect.w - 2, y: rect.y + rect.h / 2, button: 'left', buttons: 0, clickCount: 1 });
  assert.ok(await ev("Number(document.getElementById('number-rojo').value)>95"),
    JSON.stringify(await ev("({value:document.getElementById('number-rojo').value,range:document.getElementById('range-rojo').value,width:innerWidth,scrollY})")));
  assert.equal(await ev("document.getElementById('crop-status').textContent"), 'Mezcla modificada');
  await ev("document.getElementById('range-verde').focus()");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
  assert.equal(await ev("Number(document.getElementById('number-verde').value)"), 6.26);
  await ev("document.getElementById('apply').click()");
  const applied = await ev("alimentosTest.estados.lechuga.aplicada.rojo");
  assert.ok(applied > 95);
  await ev("document.querySelector('[data-crop=mizuna]').click();document.querySelector('[data-crop=lechuga]').click()");
  assert.equal(await ev("alimentosTest.estados.lechuga.borrador.rojo"), applied);
  assert.equal(await ev("alimentosTest.estados.mizuna.aplicada.rojo"), 81.8);
  assert.equal(await ev("document.getElementById('env-temperature').textContent"), '22,2–23,3 °C');
  console.log('PASS arrastre real, decimales, aplicar y persistencia independiente sin alterar ambiente.');
  await ev("document.getElementById('settings-open').click();document.getElementById('stage-select').value='0';document.getElementById('stage-select').dispatchEvent(new Event('change'));document.getElementById('day-input').value='20';document.getElementById('day-input').dispatchEvent(new Event('change'));document.getElementById('reset-light').click()");
  assert.ok((await ev("document.getElementById('chamber').dataset.plant")).includes('etapa0_semilla'));
  assert.equal(await ev("document.getElementById('crop-day').textContent"), '20');
  assert.equal(await ev("document.getElementById('number-rojo').value"), '75');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until(() => ev("!document.getElementById('settings-dialog').open"), 'cierre de ajustes con Escape');
  assert.equal(await ev("document.getElementById('settings-dialog').open"), false);
  const respuestas = { mizuna: 'iss', lechuga: 'iss', chile: 'aproximada', tomate: 'sin_dato', papa: 'sin_dato', trigo: 'sin_dato' };
  for (const [id, [referencia]] of Object.entries(configs)) {
    await ev(`document.querySelector('.crop-button[data-crop="${id}"]').click();document.getElementById('mission-start').click()`);
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.fase`), 'ajustar');
    assert.equal(await ev("document.getElementById('stage-select').disabled"), true);
    assert.ok((await ev("document.getElementById('chamber').dataset.plant")).includes('etapa0_semilla'));
    await ev("document.getElementById('apply').click();document.getElementById('mission-hint').click()");
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.puntos`), 0);
    assert.ok((await ev("document.getElementById('mission-vega').textContent")).includes('VEGA'));
    if (id === 'mizuna') {
      await screenshot('mision-falla');
      const guardado = await ev("JSON.stringify(alimentosTest.estados.mizuna)");
      await ev("document.querySelector('.crop-button[data-crop=tomate]').click();document.querySelector('.crop-button[data-crop=mizuna]').click()");
      assert.equal(await ev("JSON.stringify(alimentosTest.estados.mizuna)"), guardado);
    }
    for (let ronda = 0; ronda < 3; ronda++) {
      for (const [i, canal] of ['rojo', 'azul', 'verde', 'blanco'].entries()) {
        await ev(`(()=>{const input=document.getElementById('number-${canal}');input.value=${referencia[i]};input.dispatchEvent(new Event('input'));})()`);
      }
      await ev("document.getElementById('apply').click()");
      assert.equal(await ev(`alimentosTest.estados.${id}.mision.fase`), 'registrar');
      const puntos = await ev(`alimentosTest.estados.${id}.mision.puntos`);
      await ev("document.getElementById('apply').click()");
      assert.equal(await ev(`alimentosTest.estados.${id}.mision.puntos`), puntos);
      await ev("document.getElementById('mission-next').click()");
      assert.equal(await ev(`alimentosTest.estados.${id}.mision.registros.length`), ronda + 1);
    }
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.fase`), 'ficha');
    await ev(`document.querySelector('#mission-question input:not([value="${respuestas[id]}"])').click();document.getElementById('mission-next').click()`);
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.puntos`), 375);
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.fase`), 'ficha');
    await ev(`document.querySelector('#mission-question input[value="${respuestas[id]}"]').click();document.getElementById('mission-next').click()`);
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.fase`), 'completa');
    assert.equal(await ev(`alimentosTest.estados.${id}.mision.puntos`), 450);
    assert.equal(await ev("document.getElementById('mission-badge').hidden"), false);
    assert.ok((await ev("document.getElementById('chamber').dataset.plant")).includes('etapa5_lista_cosecha'));
    if (id === 'mizuna') await screenshot('mision-completa');
  }
  assert.ok((await ev("document.getElementById('collection-status').textContent")).includes('6/6 insignias'));
  assert.ok((await ev("document.getElementById('collection-status').textContent")).includes('2700'));
  assert.equal(await ev("document.getElementById('mission-next').disabled"), true);
  console.log('PASS seis misiones: reparación, tres cuidados, fichas, insignias, pistas sin penalizar y premios únicos.');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('movil');
  assert.ok(await ev("document.documentElement.scrollWidth<=innerWidth+1"), 'sin desbordamiento horizontal móvil');
  assert.deepEqual(errors, [], 'sin excepciones JS');
  assert.deepEqual(missing, [], 'sin 404');
  assert.deepEqual(firmas(), before, 'final, principal, src y sprites originales intactos');
  console.log('PASS ajustes visuales, Escape, móvil y carga completa; originales intactos.');
  console.log(`Capturas: ${temp}/alimentos-*.png`);
} finally {
  ws?.close(); chrome.kill(); server.kill();
}
