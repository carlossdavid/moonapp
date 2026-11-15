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
  const closeCleaning = ui.cleaning.close.bind(ui.cleaning);
  ui.cleaning.close = () => { if (ui.cleaning.isOpen) ui.transition(); closeCleaning(); };
  ui.cleaning.finishButton.textContent = 'Salir · tarea completada';
  $('cancel-task').textContent = 'Salir';
  $('close-monitor').textContent = 'Salir · Esc';
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
    this.foodFrame = null;
    $('activity-frame').addEventListener('load', () => this.styleFrame($('activity-frame')));
    $('activity-close').addEventListener('click', () => this.close());
    $('close-monitor').addEventListener('click', () => { this.transition(); this.restoreFocus(); });
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
        const controls = [...$(this.kind === 'story' ? 'story' : 'activity').querySelectorAll('button, iframe, video')]
          .filter(element => element.getClientRects().length && !element.disabled);
        const index = controls.indexOf(document.activeElement);
        event.preventDefault();
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    });
  }

  get blocked() {
    return this.game?.mission.dead || !!this.kind || this.cleaning?.isOpen || !$('monitor-content').hidden
      || document.getElementById('visor-overlay')?.hidden === false;
  }

  notify(text, title = 'COMUNICACIONES') {
    clearTimeout(this.noticeTimer);
    $('notice-title').textContent = title;
    $('notice-text').textContent = text;
    $('notice').hidden = false;
    $('notice').animate([{ opacity: 0, translate: '0 -6px' }, { opacity: 1, translate: '0 0' }],
      { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240, easing: 'ease-out' });
    this.noticeTimer = setTimeout(() => $('notice').hidden = true, 6500);
  }

  rememberFocus() { this.lastFocus = document.activeElement; }
  restoreFocus() { (this.lastFocus || $('game')).focus?.(); }

  openConsole() {
    if (this.blocked) return;
    this.transition();
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
    if (kind === 'recharge' || kind === 'battery') {
      this.game.scene.openOxygen?.();
      return;
    }
    this.transition();
    this.rememberFocus();
    this.kind = kind;
    $('activity').hidden = false;
    $('activity-heading').textContent = { modes: 'MODOS DE ESTACIÓN', food: 'RESCATE DEL INVERNADERO',
      result: 'MISIÓN COMPLETADA' }[kind] || 'OPERACIÓN ELECTRÓLISIS';
    const frame = $('activity-frame');
    frame.hidden = true;
    $('activity-intro').hidden = true;
    if (kind === 'food') {
      if (!this.foodFrame) {
        this.foodFrame = document.createElement('iframe');
        this.foodFrame.className = 'mode-frame';
        this.foodFrame.title = 'Misión de alimentación';
        this.foodFrame.src = 'pruebas/Alimentos/?embed=1';
        frame.parentElement.append(this.foodFrame);
      }
      this.foodFrame.hidden = false;
      this.currentFrame = this.foodFrame;
    } else if (kind === 'result') {
      $('activity-intro').hidden = false;
      const text = document.createElement('p');
      text.textContent = 'Tarea completada. Puedes salir cuando quieras.';
      $('activity-intro').replaceChildren(text);
    } else if (kind === 'modes') {
      let modes = this.modeFrames.get(stationId);
      if (!modes) {
        modes = document.createElement('iframe');
        modes.className = 'mode-frame';
        modes.title = `Modos de estación ${stationId}`;
        modes.src = 'pruebas/CambioDeModo/ModosDeEstacion/minijuego cambiar modo.html';
        modes.addEventListener('load', () => {
          this.styleFrame(modes);
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
    if (this.kind === 'story' && !$('story-video').getAttribute('src')) return;
    this.transition();
    if (this.kind === 'story') {
      clearTimeout(this.storyTimer);
      const video = $('story-video');
      video.pause(); video.removeAttribute('src'); video.load();
      $('story').hidden = true;
      const onClose = this._storyOnClose;
      this._storyOnClose = null;
      if (onClose) onClose();
    } else if (this.kind === 'food') {
      this.foodFrame.hidden = true;
    } else if (this.kind === 'modes') {
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
    if (event.source === this.foodFrame?.contentWindow && this.kind === 'food') {
      if (data?.type === 'alimentos:close') this.close();
      if (data?.type === 'alimentos:harvest'
        && ['mizuna', 'lechuga', 'chile', 'tomate', 'papa', 'trigo'].includes(data.crop)) this.game.harvest(data.crop);
      return;
    }
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

  async transition(change) {
    const curtain = $('mission-transition');
    const token = {};
    this.transitionActive = token;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 80 : 300;
    const easing = 'cubic-bezier(.22,.61,.36,1)';
    $('vega-message').hidden = true;
    $('interaction-hint').hidden = true;
    try {
      if (change) {
        const fade = curtain.animate([{ opacity: 0 }, { opacity: 1 }],
          { duration, easing, fill: 'forwards' });
        await fade.finished;
        try { await change(); }
        finally {
          fade.cancel();
          await curtain.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration, easing }).finished;
        }
      } else {
        await curtain.animate([{ opacity: 0 }, { opacity: .75, offset: .4 }, { opacity: 0 }],
          { duration: duration * 2, easing }).finished;
      }
    } finally {
      if (this.transitionActive === token) this.transitionActive = null;
    }
  }

  styleFrame(frame) {
    const doc = frame.contentDocument;
    if (!doc?.head || doc.getElementById('final-pixel-theme')) return;
    const style = doc.createElement('style');
    style.id = 'final-pixel-theme';
    const font = new URL('assets/fonts/PressStart2P-Regular.ttf', document.baseURI).href;
    style.textContent = `@font-face{font-family:FinalPixel;src:url("${font}")}body,button,input,select,p,h1,h2,h3,span,div{font-family:FinalPixel,monospace!important}button{border-radius:0!important}`;
    doc.head.append(style);
  }

  updateSurvival() {
    const m = this.game.mission, status = $('survival');
    const text = m.dead ? 'MISIÓN FALLIDA · SIN RECURSOS' : m.starved > 0
      ? `¡DAÑO! VIDA ${Math.ceil(m.health)} % · ${Math.max(0, 5 - m.starved).toFixed(1)} s para recuperarte`
      : 'VIDA 100 %';
    if ($('survival-text').textContent !== text) $('survival-text').textContent = text;
    status.classList.toggle('danger', m.starved > 0);
    status.hidden = m.starved <= 0;
    if (m.dead) {
      const player = this.game?.scene?.player || this.game?.player;
      if (player && typeof player.die === 'function') player.die();
      const sprite = player?.sprite;
      const anim = sprite?.current;
      const deathAnimDone = !sprite || anim?.name !== 'dead' || !!anim.finished;
      if (deathAnimDone) {
        if ($('death').hidden) {
          $('death').hidden = false;
          $('restart-mission').focus();
        }
      } else {
        $('death').hidden = true;
      }
    }
  }

  setHint(text) {
    const hint = $('interaction-hint');
    hint.hidden = !text || this.blocked || this.transitionActive || this.game?.transitioning;
    if (hint.textContent !== text) hint.textContent = text || '';
  }

  openStory() {
    if (this.blocked || this.game.transitioning || this.game.scene?.isRecarga) return;
    this.game.mission.alertPending = false;
    this.game.mission.alertShown = true;
    this.openCinematic({
      src: 'assets/video/segunda_escena.mp4',
      exitText: 'Salir · activar visor',
      exitTextOnEnd: 'Salir · activar visor',
      onClose: () => {
        this.game.mission.visorUnlocked = true;
        document.querySelector('.visor-launcher').textContent = 'Visor · SHIFT';
        this.notify('Aplasta Shift para abrir el panel');
      },
    });
  }

  openCinematic({ src, exitText = 'Salir', exitTextOnEnd = 'Salir', onClose = null, autoStartMs = 2500, showAviso = true } = {}) {
    if (this.blocked || this.game.transitioning || this.game.scene?.isRecarga) return false;
    this.kind = 'story';
    this._storyOnClose = typeof onClose === 'function' ? onClose : null;
    this.transition();
    $('story').hidden = false;
    const video = $('story-video');
    const start = $('story-start');
    const exit = $('story-exit');
    const aviso = $('story').querySelector('img');
    if (aviso) aviso.style.display = showAviso ? '' : 'none';
    video.hidden = true;
    start.hidden = false;
    exit.hidden = true;
    exit.textContent = exitText;
    start.onclick = () => {
      clearTimeout(this.storyTimer);
      start.hidden = true;
      video.hidden = false;
      video.src = src;
      exit.hidden = false;
      video.play().catch(() => { start.hidden = false; });
    };
    video.onended = () => { exit.textContent = exitTextOnEnd; };
    exit.onclick = () => this.close();
    this.storyTimer = setTimeout(() => { if (this.kind === 'story') start.click(); }, autoStartMs);
    start.focus();
    return true;
  }
}
