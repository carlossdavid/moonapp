import { translate } from './i18n.js';

/** Intercepta solo el texto dibujado por la recarga integrada, sin modificar la prueba. */
export function localizeRechargeRender(scene, language) {
  if (language !== 'en') return;
  const render = scene.render.bind(scene);
  scene.render = renderer => {
    const ctx = renderer.context;
    const fillText = ctx.fillText;
    const measureText = ctx.measureText;
    ctx.fillText = function (text, ...args) {
      return fillText.call(this, translate(text, 'en'), ...args);
    };
    ctx.measureText = function (text) {
      return measureText.call(this, translate(text, 'en'));
    };
    try { render(renderer); }
    finally {
      ctx.fillText = fillText;
      ctx.measureText = measureText;
    }
  };
}
