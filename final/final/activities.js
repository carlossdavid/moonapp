import { PanelCleaningTask } from '../pruebas/limpieza-panel/PanelCleaningTask.js';
import { loadPanelSprites } from '../pruebas/limpieza-panel/spriteAtlas.js';

const $ = id => document.getElementById(id);
async function page(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo leer ${path}: ${response.status}`);
  return new DOMParser().parseFromString(await response.text(), 'text/html');
}

export async function mountActivities() {
  const [cleaning, weather, sprites] = await Promise.all([
    page('pruebas/limpieza-panel/index.html'),
    page('pruebas/clima-espacial/index.html'),
    loadPanelSprites(),
  ]);
  const host = $('game-root');
  host.append(document.importNode(cleaning.getElementById('cleaning-task'), true));
  host.append(document.importNode(weather.getElementById('monitor-content'), true));
  // Contrato DOM de app.js; se conserva oculto, sin ejecutar otro juego.
  const legacy = weather.querySelector('#game-root > div[hidden]');
  if (!legacy) throw new Error('Contrato del monitor DONKI incompleto');
  host.append(document.importNode(legacy, true));

  const ui = new Activities();
  ui.cleaning = new PanelCleaningTask({
    root: $('cleaning-task'), canvas: $('task-canvas'), sprites, onFinish: () => {},
  });
  // Los receptores (incluido el visor) se montan antes del primer muestreo.
  return ui;
}

class Activities {
  constructor() {
    this.cleaning = null;
    this.kind = null;
    this.game = null;
    this.currentFrame = null;
    this.modeFrames = new Map();
    this.lastFocus = null;
    $('activity-close').addEventListener('click', () => this.close());
    $('close-monitor').addEventListener('click', () => this.restoreFocus());
    $('help-toggle').addEventListener('click', () => {
      $('help-panel').hidden = !$('help-panel').hidden;
      $('help-toggle').setAttribute('aria-expanded', String(!$('help-panel').hidden));
    });
    window.addEventListener('message', event => this.message(event));
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        if (this.kind) { event.preventDefault(); this.close(); }
        else if (!$('monitor-content').hidden) { event.preventDefault(); $('close-monitor').click(); }
      }
      if (event.code === 'Tab' && this.kind) {
        const controls = [...$('activity').querySelectorAll('button, iframe')]
          .filter(element => element.getClientRects().length && !element.disabled);
        const index = controls.indexOf(document.activeElement);
        event.preventDefault();
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    });
  }

  get blocked() {
    return !!this.kind || this.cleaning?.isOpen || !$('monitor-content').hidden
      || document.getElementById('visor-overlay')?.hidden === false;
  }

  notify(text) {
    clearTimeout(this.noticeTimer);
    $('notice').textContent = text;
    $('notice').hidden = false;
    this.noticeTimer = setTimeout(() => $('notice').hidden = true, 6500);
  }

  rememberFocus() { this.lastFocus = document.activeElement; }
  restoreFocus() { (this.lastFocus || $('game')).focus?.(); }

  openConsole() {
    if (this.blocked) return;
    this.rememberFocus();
    $('open-monitor').click();
    $('close-monitor').focus();
  }

  openEnergy(stationId) {
    if (this.blocked) return;
    this.rememberFocus();
    this.kind = 'energy';
    $('activity').hidden = false;
    $('activity-heading').textContent = 'CONTROL DE ENERGÍA';
    $('activity-frame').hidden = true;
    $('activity-intro').hidden = false;
    const title = document.createElement('p');
    title.textContent = 'Elige la actividad de la estación:';
    $('activity-intro').replaceChildren(title);
    for (const [kind, label] of [['modes', 'Modos y calibración'], ['electrolysis', 'Operación electrólisis']]) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => { this.close(); this.open(kind, stationId); });
      $('activity-intro').append(button);
    }
    $('activity-close').focus();
  }

  open(kind, stationId) {
    if (this.blocked) return;
    this.rememberFocus();
    this.kind = kind;
    $('activity').hidden = false;
    $('activity-heading').textContent = kind === 'modes' ? 'MODOS DE ESTACIÓN' : 'OPERACIÓN ELECTRÓLISIS';
    const frame = $('activity-frame');
    frame.hidden = true;
    if (kind === 'modes') {
      let modes = this.modeFrames.get(stationId);
      if (!modes) {
        modes = document.createElement('iframe');
        modes.className = 'mode-frame';
        modes.title = `Modos de estación ${stationId}`;
        modes.src = 'pruebas/CambioDeModo/ModosDeEstacion/minijuego cambiar modo.html';
        modes.addEventListener('load', () => {
          modes.contentDocument?.addEventListener('keydown', event => {
            if (event.code === 'Escape') { event.preventDefault(); this.close(); }
          });
        });
        frame.parentElement.append(modes);
        this.modeFrames.set(stationId, modes);
      }
      modes.hidden = false;
      this.currentFrame = modes;
    } else {
      $('activity-intro').hidden = false;
      $('activity-intro').replaceChildren();
      const text = document.createElement('p');
      text.textContent = 'La electrólisis separa agua en hidrógeno y oxígeno. En esta actividad de puntería: cañón rojo → O₂ rojo; cañón azul → H₂ azul. La ronda dura 25 segundos. Los resultados son indicadores educativos, no producción física de la base.';
      const start = document.createElement('button');
      start.textContent = 'Iniciar electrólisis';
      start.addEventListener('click', () => {
        $('activity-intro').hidden = true;
        frame.hidden = false;
        frame.src = 'pruebas/operacion-electrolisis/index.html?embed=1';
        frame.focus();
      });
      $('activity-intro').append(text, start);
      this.currentFrame = frame;
    }
    $('activity-close').focus();
  }

  close() {
    if (!this.kind) return;
    if (this.kind === 'modes') {
      // Detener una calibración incompleta, conservando las ya terminadas.
      this.currentFrame.contentDocument?.getElementById('modalClose')?.click();
      this.currentFrame.hidden = true;
    } else {
      $('activity-frame').src = 'about:blank';
      $('activity-frame').hidden = true;
    }
    $('activity-intro').hidden = true;
    $('activity').hidden = true;
    this.kind = null;
    this.currentFrame = null;
    this.game?.input.update();
    this.restoreFocus();
  }

  message(event) {
    if (event.origin !== location.origin) return;
    const data = event.data;
    const modeStation = [...this.modeFrames].find(([, frame]) => frame.contentWindow === event.source)?.[0];
    if (modeStation && data?.type === 'energyModeChanged'
      && ['tortuga', 'explorador', 'turbo'].includes(data.mode)) {
      // El minijuego anuncia el éxito tras 650 ms. Puede haberse cerrado la
      // ventana mientras tanto: guardar el resultado en la estación correcta.
      this.game.stationModes.set(modeStation, data.mode);
      if (this.game.scene.station?.id === modeStation) this.game.scene.applyEnergyMode?.(data.mode);
      if (this.kind === 'modes') this.notify(`Modo ${data.mode} aplicado a esta estación.`);
    } else if (this.kind === 'electrolysis' && event.source === this.currentFrame?.contentWindow
      && data?.type === 'electrolisis:close') {
      this.lastElectrolysis = data.summary;
      this.close();
      this.notify('Operación terminada. Informe educativo guardado; recursos físicos sin conversiones ficticias.');
    }
  }
}
