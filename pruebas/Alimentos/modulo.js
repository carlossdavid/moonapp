const root = document.querySelector('.simulator');
function fit() {
  const scale = Math.min(innerWidth / 1440, innerHeight / 900);
  root.style.transform = `scale(${scale})`;
  root.style.left = `${(innerWidth - 1440 * scale) / 2}px`;
  root.style.top = `${(innerHeight - 900 * scale) / 2}px`;
}
function screen(name) {
  root.dataset.screen = name;
  document.querySelectorAll('[data-screen]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.screen === name));
  });
}
window.addEventListener('resize', fit);
fit(); screen('mission');
document.querySelector('.mission-journal').open = true;
document.querySelectorAll('button[data-screen]').forEach(button => {
  button.onclick = () => screen(button.dataset.screen);
});
document.getElementById('mission-start').addEventListener('click', () => screen('crop'));
document.getElementById('apply').addEventListener('click', () => {
  if (document.getElementById('mission-card').dataset.phase === 'registrar') screen('mission');
});
document.getElementById('mission-next').addEventListener('click', () => {
  if (document.getElementById('mission-card').dataset.phase === 'ajustar') screen('crop');
});
const exit = () => {
  if (window.parent !== window) window.parent.postMessage({ type: 'alimentos:close' }, location.origin);
  else {
    screen('mission');
    document.getElementById('mission-vega').textContent = 'Misión pausada. Puedes continuar con tu progreso conservado.';
  }
};
document.getElementById('mission-exit').onclick = exit;
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !document.getElementById('settings-dialog').open) exit();
});
