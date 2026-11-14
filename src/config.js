/** @file Global configuration constants (no magic numbers). */

// Logical/render resolution
export const LOGICAL_WIDTH = 320;
export const LOGICAL_HEIGHT = 180;
export const BASE_SCALE = 1; // actual display scale is computed to fit the browser window (integer)
export const TILE_SIZE = 16;

// Timing
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25; // seconds, clamp to avoid spiral of death
export const MAX_FIXED_STEPS_PER_FRAME = 5;
export const MAX_MOVE_PER_STEP = 8; // pixels, anti-tunneling subdivision threshold

// Player
export const PLAYER_SPEED = 70; // px/s
export const PLAYER_ACCEL = 800; // px/s^2
export const PLAYER_FRICTION = 1200; // px/s^2
export const PLAYER_FOOT_WIDTH = 10;
export const PLAYER_FOOT_HEIGHT = 6;

// Camera
export const CAMERA_LERP = 8; // smoothing factor (higher = snappier)

// World / map
export const MAP_COLS = 40;
export const MAP_ROWS = 30;

// Physics
export const SPATIAL_CELL_SIZE = 32;

// Debug
export const DEBUG_TOGGLE_KEY = 'F1';

// Collision layers (bitmask)
export const Layer = Object.freeze({
  NONE: 0,
  PLAYER: 1 << 0,
  SOLID: 1 << 1,
  TRIGGER: 1 << 2,
});

/**
 * @param {number} mask
 * @param {number} layer
 * @returns {boolean}
 */
export function layerMatches(mask, layer) {
  return (mask & layer) !== 0;
}
