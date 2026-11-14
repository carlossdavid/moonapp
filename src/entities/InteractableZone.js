import { Entity } from './Entity.js';
import { Player } from './Player.js';

/**
 * Invisible trigger zone that tracks player proximity and exposes prompt/interaction state.
 */
export class InteractableZone extends Entity {
  /**
   * @param {{
   *  x:number, y:number, body:any, name:string, prompt:string,
   *  requiresConfirm?:boolean, onConfirm?: (zone:InteractableZone, player:Player)=>void
   * }} opts
   */
  constructor(opts) {
    super({ x: opts.x, y: opts.y, body: opts.body });
    this.name = opts.name;
    this.prompt = opts.prompt;
    this.requiresConfirm = !!opts.requiresConfirm;
    this.onConfirm = opts.onConfirm || null;
    this.playerInside = false;
    this.confirmPending = false;
  }

  update() { /* state driven by triggers/input */ }
  render() { /* invisible */ }

  onTriggerEnter(other, otherEntity) {
    if (otherEntity instanceof Player) this.playerInside = true;
  }

  onTriggerStay(other, otherEntity) {
    if (otherEntity instanceof Player) this.playerInside = true;
  }

  onTriggerExit(other, otherEntity) {
    if (otherEntity instanceof Player) {
      this.playerInside = false;
      this.confirmPending = false;
    }
  }

  /** @param {import('../core/Game.js').Game} game */
  handleInput(game) {
    if (!this.playerInside) return false;
    const input = game.input;

    if (this.requiresConfirm) {
      if (!this.confirmPending) {
        // prompt shown by scene; first E arms confirmation or we show prompt and wait for E as yes
        if (input.isPressed('KeyE')) {
          // confirm immediately on E when prompt visible? requirement: show "¿Quieres entrar...? (E sí / Esc no)"
          if (this.onConfirm) this.onConfirm(this, /** @type {any} */ (game.player));
          return true;
        }
        if (input.isPressed('Escape')) {
          this.confirmPending = false;
          return false;
        }
      } else {
        if (input.isPressed('KeyE')) {
          if (this.onConfirm) this.onConfirm(this, /** @type {any} */ (game.player));
          return true;
        }
        if (input.isPressed('Escape')) {
          this.confirmPending = false;
        }
      }
      return false;
    }

    // simple inspect
    if (input.isPressed('KeyE')) {
      this._inspectFlash = 1.5;
      return true;
    }
    return false;
  }

  getDisplayPrompt() {
    if (!this.playerInside) return '';
    if (this.requiresConfirm) return this.prompt;
    if (this._inspectFlash && this._inspectFlash > 0) return `${this.name}: inspeccionado`;
    return this.prompt;
  }

  tick(dt) {
    if (this._inspectFlash > 0) this._inspectFlash -= dt;
  }
}
