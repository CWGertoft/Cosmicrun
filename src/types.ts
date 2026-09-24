export type Language = "sv" | "en";

export type GameState = "menu" | "instructions" | "intro" | "playing" | "game-over";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Obstacle {
  x: number;
  gapCenter: number;
  gapHeight: number;
  width: number;
  coinAvailable: boolean;
  scored: boolean;
  coinCollected: boolean;
  coinYOffset: number;
}

export interface LandingPlatform {
  x: number;
  top: number;
  width: number;
  height: number;
}

export interface Player {
  x: number;
  y: number;
  velocityY: number;
  flapCount: number;
  grounded: boolean;
  dead: boolean;
  animationTime: number;
  deathTime: number;
}
