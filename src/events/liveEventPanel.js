import { loadSpaceWeatherEvents } from './spaceWeatherEvents.js';
import { fetchDonkiRecent, normalizeDonkiEvent, LIVE_POLL_MS, RATE_LIMIT_POLL_MS } from './donkiLive.js';

// Independiente de DemoScene: P1 puede escuchar 'lunar:donki-alert' cuando
// exista una misión/estado al que conectar consecuencias de juego.
const root = document.getElementById('game-root');
if (root) {
  const css = document.createElement('style');
  css.textContent = `
    .donki-monitor { position:absolute; z-index:10; right:12px; top:12px; width:min(340px,calc(100vw - 24px));
      color:#f2f6f4; font:13px/1.45 system-ui,sans-serif; background:rgba(9,25,39,.96);
      border:1px solid #7994a0; border-radius:8px; box-shadow:0 8px 28px #0009; }
    .donki-monitor * { box-sizing:border-box; }
    .donki-monitor button { color:#f2f6f4; background:#244455; border:1px solid #819bab;
      border-radius:4px; padding:6px 9px; cursor:pointer; font:inherit; }
    .donki-monitor button:hover { background:#385c70; }
    .donki-monitor button:focus-visible, .donki-monitor a:focus-visible { outline:2px solid #f5bf69; outline-offset:2px; }
    .donki-monitor a { color:#a6e8d2; }
    .donki-head { display:flex; align-items:center; gap:8px; padding:10px 12px; }
    .donki-head strong { flex:1; font-size:14px; }
    .donki-body { padding:0 12px 12px; max-height:min(65vh,480px); overflow:auto; }
    .donki-body p { margin:6px 0; }
    .donki-status { color:#d2e0e4; }
    .donki-event { border-top:1px solid #456576; padding:10px 0; }
    .donki-event strong { display:block; color:#f5bf69; }
    .donki-event time, .donki-event small { color:#bbd2d7; display:block; }
    .donki-actions { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
    .donki-new { color:#ffbd85; font-weight:700; }
    @media (max-width:500px) { .donki-monitor { top:auto; bottom:10px; } }
  `;
  document.head.append(css);

  const monitor = document.createElement('section');
  monitor.className = 'donki-monitor';
  monitor.setAttribute('aria-label', 'Clima espacial DONKI');
  const header = document.createElement('div');
  header.className = 'donki-head';
  const heading = document.createElement('strong');
  heading.textContent = 'Clima espacial · NASA DONKI';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Abrir';
  toggle.setAttribute('aria-expanded', 'false');
  const body = document.createElement('div');
  body.className = 'donki-body';
  body.hidden = true;
  const status = document.createElement('p');
  status.className = 'donki-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Cargando registros…';
  const explainer = document.createElement('p');
  explainer.textContent = 'Datos publicados por DONKI, no mediciones en la base lunar. Se revisan aproximadamente cada 5 min mientras esta pestaña esté visible.';
  const actions = document.createElement('div');
  actions.className = 'donki-actions';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Actualizar';
  const test = document.createElement('button');
  test.type = 'button';
  test.textContent = 'Probar alerta archivada';
  const list = document.createElement('div');
  actions.append(refresh, test);
  body.append(status, explainer, actions, list);
  header.append(heading, toggle);
  monitor.append(header, body);
  root.append(monitor);
  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? 'Abrir' : 'Cerrar';
    toggle.setAttribute('aria-expanded', String(!body.hidden));
  });

  const seen = new Map();
  let archive = null;
  let latest = [];
  let activeRequest = false;
  let nextAllowed = 0;
  let rateLimitUntil = 0;
  let timer = null;

  function emit(event, archived = false) {
    document.dispatchEvent(new CustomEvent('lunar:donki-alert', {
      detail: { event, archived }
    }));
  }

  function showEvents(events, archived) {
    list.replaceChildren();
    const recent = events.slice(0, 12);
    if (!recent.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay registros de estos cuatro tipos en la ventana consultada.';
      list.append(empty);
      return;
    }
    for (const event of recent) {
      const item = document.createElement('article');
      item.className = 'donki-event';
      const title = document.createElement('strong');
      title.textContent = `${event.type} · ${event.detail}`;
      const time = document.createElement('time');
      time.textContent = `Observado: ${event.time}${archived ? ' · ARCHIVO' : ''}`;
      const guidance = document.createElement('p');
      guidance.textContent = event.guidance;
      const source = document.createElement('a');
      source.href = event.url;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = `Ver registro ${event.id}`;
      item.append(title, time, guidance, source);
      if (event.instrument) {
        const instrument = document.createElement('small');
        instrument.textContent = `Fuente: ${event.instrument}`;
        item.append(instrument);
      }
      if (event.linkedIds.length) {
        const linked = document.createElement('small');
        linked.textContent = `${event.linkedIds.length} registros enlazados en DONKI; no equivalen necesariamente a impactos distintos.`;
        item.append(linked);
      }
      if (event.notificationId) {
        const notification = document.createElement('small');
        notification.textContent = `Notificación ${event.notificationId}`;
        item.append(notification);
      }
      list.append(item);
    }
  }

  async function useArchive() {
    if (!archive) {
      try { archive = await loadSpaceWeatherEvents(); }
      catch { status.textContent = 'No hay conexión y falta el respaldo local.'; return; }
    }
    const archived = archive.eventos.map((event) => ({
      type: event.tipo, id: event.identificadorNASA, time: event.observadoUTC,
      detail: event.titulo, guidance: event.impactoReal, url: event.urlNASA,
      linkedIds: event.enlacesVerificados || [], notificationId: event.idNotificacion || null
    }));
    // Copias de los JSON que el usuario ya tenía en Eventos/. Deben estar
    // dentro de moonapp/ para poder publicarse más tarde en GitHub Pages.
    const originals = await Promise.allSettled(['SEP', 'GST'].map(async (type) => {
      const response = await fetch(new URL(`../../assets/donki/${type}.json`, import.meta.url));
      if (!response.ok) throw new Error(`Archivo ${type} no encontrado`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error(`Archivo ${type} inválido`);
      return rows.map((row) => normalizeDonkiEvent(type, row)).filter(Boolean);
    }));
    originals.forEach((result) => {
      if (result.status === 'fulfilled') archived.push(...result.value);
    });
    showEvents(archived.sort((a, b) => Date.parse(b.time) - Date.parse(a.time)), true);
    status.textContent = 'Sin conexión: casos ARCHIVADOS, incluidos Eventos/SEP.json y Eventos/GST.json.';
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!document.hidden) void update(); }, ms);
  }

  async function update() {
    if (activeRequest || Date.now() < nextAllowed || document.hidden) return;
    activeRequest = true;
    refresh.disabled = true;
    try {
      const result = await fetchDonkiRecent();
      const newEvents = [];
      for (const type of result.successfulTypes) {
        const current = result.events.filter((event) => event.type === type);
        const known = seen.get(type);
        if (known) newEvents.push(...current.filter((event) => !known.has(event.id)));
        seen.set(type, new Set(current.map((event) => event.id)));
        latest = latest.filter((event) => event.type !== type).concat(current);
      }
      showEvents(latest.sort((a, b) => Date.parse(b.time) - Date.parse(a.time)), false);
      const failed = result.errors.length ? `; ${result.errors.map((error) => error.type).join(', ')} no disponible(s)` : '';
      status.textContent = `Consulta: ${result.fetchedAt}${failed}. ${newEvents.length ? `${newEvents.length} registro(s) nuevos desde la última consulta.` : 'Sin novedades desde la última consulta.'}`;
      status.classList.toggle('donki-new', newEvents.length > 0);
      if (newEvents.length) {
        body.hidden = false;
        toggle.textContent = 'Cerrar';
        toggle.setAttribute('aria-expanded', 'true');
        newEvents.forEach((event) => emit(event));
      }
      const limited = result.errors.some((error) => error.status === 429);
      rateLimitUntil = limited ? Date.now() + RATE_LIMIT_POLL_MS : 0;
      nextAllowed = Date.now() + (limited ? RATE_LIMIT_POLL_MS : LIVE_POLL_MS);
      schedule(limited ? RATE_LIMIT_POLL_MS : LIVE_POLL_MS);
    } catch (error) {
      if (!latest.length) await useArchive();
      else status.textContent = 'Últimos registros consultados; no se pudieron actualizar. No son datos en vivo.';
      status.classList.remove('donki-new');
      const delay = error.rateLimited ? RATE_LIMIT_POLL_MS : LIVE_POLL_MS;
      rateLimitUntil = error.rateLimited ? Date.now() + RATE_LIMIT_POLL_MS : 0;
      nextAllowed = Date.now() + delay;
      schedule(delay);
    } finally {
      activeRequest = false;
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', () => {
    if (Date.now() < rateLimitUntil) {
      status.textContent = 'DONKI limitó las consultas; esperaremos antes de reintentar.';
      return;
    }
    nextAllowed = 0;
    void update();
  });
  test.addEventListener('click', async () => {
    if (!archive) {
      try { archive = await loadSpaceWeatherEvents(); }
      catch { status.textContent = 'No se pudo cargar el ejemplo archivado.'; return; }
    }
    const event = archive.eventos.find((item) => item.tipo === 'SEP');
    if (!event) return;
    status.textContent = `SIMULACIÓN: evento archivado ${event.observadoUTC}; no está ocurriendo ahora ni se ha medido en esta base.`;
    status.classList.add('donki-new');
    body.hidden = false;
    toggle.textContent = 'Cerrar';
    toggle.setAttribute('aria-expanded', 'true');
    const example = { type:'SEP', id:event.identificadorNASA, time:event.observadoUTC,
      detail:event.titulo, guidance:event.impactoReal, url:event.urlNASA,
      linkedIds:event.enlacesVerificados || [], notificationId:event.idNotificacion || null };
    showEvents([example, ...latest], false);
    const exampleTime = list.querySelector('time');
    if (exampleTime) exampleTime.textContent += ' · SIMULACIÓN ARCHIVADA';
    emit(example, true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() >= nextAllowed) void update();
  });
  void update();
}
