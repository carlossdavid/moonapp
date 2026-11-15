// Integración visual opcional: requiere Chrome y un servidor desde moonapp.
// node pruebas/MonitorVisor/visor.browser.test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9324;
const browser = spawn(chromePath, [
  '--headless=new', '--no-first-run', `--remote-debugging-port=${port}`,
  '--window-size=1440,900',
  `--user-data-dir=${process.env.TEMP ?? 'C:/Users/Usuario/AppData/Local/Temp'}/opencode/visor-browser-test`,
  'about:blank',
], { stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tab;
  for (let i = 0; i < 80; i++) {
    try {
      tab = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find(item => item.type === 'page');
      if (tab) break;
    } catch { /* Chrome iniciando */ }
    await wait(100);
  }
  assert.ok(tab, 'Chrome debe iniciar');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => { ws.onopen = resolve; });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = (await send('Runtime.evaluate', { expression, returnByValue: true })).result;
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description);
    return response.result.value;
  };
  const shift = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  };
  const capture = async name => {
    if (!process.env.VISOR_SCREENSHOTS) return;
    const screenshot = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
    writeFileSync(`${process.env.TEMP ?? 'C:/Users/Usuario/AppData/Local/Temp'}/opencode/${name}.png`,
      Buffer.from(screenshot, 'base64'));
  };
  for (const path of ['MonitorVisor', 'clima-espacial']) {
    await send('Page.navigate', { url: `http://127.0.0.1:8765/pruebas/${path}/?seed=42` });
    for (let i = 0; i < 140; i++) {
      if (await evaluate("!!document.querySelector('#visor-overlay') && document.querySelector('#solar-value')?.textContent !== '—'")) break;
      await wait(100);
    }
    for (let i = 0; i < 140; i++) {
      if (await evaluate("document.querySelector('#loading').classList.contains('hidden')")) break;
      await wait(100);
    }
    await wait(220);
    console.log('GAME', path, await evaluate(`({
      loading: document.querySelector('#loading').textContent,
      hidden: document.querySelector('#loading').classList.contains('hidden'),
      canvas: document.querySelector('#game').getBoundingClientRect().width
    })`));
    const menuColor = await evaluate(`Array.from(
      document.querySelector('#game').getContext('2d').getImageData(160, 60, 1, 1).data).slice(0, 3)`);
    assert.ok(menuColor.some(value => value > 20), 'el menú debe tener fondo, no un Canvas negro');
    await capture(`game-${path}-before-shift`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait(200);
    await capture(`game-${path}-playing`);
    await shift();
    await wait(300);
    const initial = await evaluate(`({
      opened: !document.querySelector('#visor-overlay').hidden,
      values: ['solar', 'particle', 'earth'].map((key, i) => [
        document.querySelector('#' + key + '-value').textContent,
        document.querySelector('#visor-' + ['solar', 'particles', 'earth'][i] + '-value').textContent
      ]),
      vega: document.querySelector('.visor-vega').textContent,
      image: document.querySelector('.visor-art').naturalWidth,
      charts: [...document.querySelectorAll('.visor-canvas')].map(chart => chart.width)
    })`);
    assert.equal(initial.opened, true);
    for (const [monitor, visor] of initial.values) assert.equal(monitor + '/100', visor);
    assert.equal(initial.vega, '');
    assert.ok(initial.image > 0 && initial.charts.every(width => width > 0));
    await capture(`visor-${path}-initial`);
    await shift();
    assert.equal(await evaluate("document.querySelector('#visor-overlay').hidden"), true);
    const before = Number(await evaluate("document.querySelector('#visor-solar-value').textContent.split('/')[0]"));
    await wait(350);
    const after = Number(await evaluate("document.querySelector('#visor-solar-value').textContent.split('/')[0]"));
    assert.ok(Number.isFinite(before) && Number.isFinite(after), 'las lecturas continúan con el visor cerrado');
    await evaluate("document.querySelector('#open-monitor').click();document.querySelector('#test-scenario').value='station';document.querySelector('#test-alert').click()");
    await shift();
    const alert = await evaluate(`({
      visor: document.querySelector('.visor-alerts').textContent,
      monitor: document.querySelector('#alerts').textContent,
      vega: document.querySelector('.visor-vega').textContent,
      level: document.querySelector('#risk-report').dataset.level
    })`);
    assert.match(alert.visor, /SEP/);
    assert.match(alert.monitor, /SEP/);
    assert.match(alert.vega, /VEGA/);
    assert.equal(alert.level, 'local');
    await capture(`visor-${path}-alert`);
    if (path === 'MonitorVisor') {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390, height: 844, mobile: true, deviceScaleFactor: 1,
      });
      await wait(250);
      const mobile = await evaluate(`({
        frame: document.querySelector('.visor-frame').getBoundingClientRect().width,
        scrollable: document.querySelector('#visor-overlay').scrollWidth >
          document.querySelector('#visor-overlay').clientWidth,
        closeVisible: document.querySelector('.visor-close').getBoundingClientRect().right <= innerWidth
      })`);
      assert.ok(mobile.frame >= 980 && mobile.scrollable && mobile.closeVisible);
      await capture('visor-mobile');
      await send('Emulation.clearDeviceMetricsOverride');
    }
    console.log(`${path}: visor, gráficas y alertas sincronizados`);
  }
  ws.close();
} finally {
  browser.kill();
}
