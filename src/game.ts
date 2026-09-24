import type { GameState, LandingPlatform, Language, Obstacle, Player, Rect } from "./types";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GROUND_Y = 610;
export const PLAYER_WIDTH = 78;
export const PLAYER_HEIGHT = 104;

export type GameEvent = "begin" | "coin" | "death" | "menu";

const OBSTACLE_WIDTH = 224;
const FIRST_OBSTACLE_X = 760;
const OBSTACLE_DISTANCE = 540;
const COIN_SPAWN_CHANCE = 0.35;
const OBSTACLE_HIT_WIDTH = 44;
const OBSTACLE_GAP_PADDING = 34;
const LANDING_PLATFORM_WIDTH = 188;
const LANDING_PLATFORM_HEIGHT = 44;
const FIRST_LANDING_PLATFORM_X = 1_080;
const LANDING_PLATFORM_DISTANCE = 1_020;
const GRAVITY = 1_650;
const FLAP_VELOCITY = -615;
const DIVE_VELOCITY = 410;
const RUN_SPEED = 255;

export class CosmicRunGame {
  public state: GameState = "menu";
  public score = 0;
  public language: Language = this.readLanguage();
  public distance = 0;
  public readonly player: Player;
  public obstacles: Obstacle[] = [];
  public landingPlatforms: LandingPlatform[] = [];

  private randomState = 0x4c4f4f50;
  private lastLandingPlatformTop = -1;
  public constructor() {
    this.player = this.createPlayer();
    this.resetRun();
    this.state = "menu";
  }

  public pressAction(): GameEvent[] {
    if (this.state === "menu") {
      return this.selectMenu("play");
    }

    if (this.state === "instructions") {
      this.state = "menu";
      return [];
    }

    if (this.state === "intro") {
      this.state = "playing";
      return ["begin"];
    }

    if (this.state === "game-over") {
      this.resetRun();
      this.state = "playing";
      return ["begin"];
    }

    if (this.player.flapCount >= 3) {
      return [];
    }

    this.player.flapCount += 1;
    this.player.grounded = false;
    this.player.animationTime = 0;
    this.player.velocityY = this.player.flapCount === 3 ? DIVE_VELOCITY : FLAP_VELOCITY;
    return [];
  }

  public selectMenu(choice: "play" | "instructions"): GameEvent[] {
    if (this.state !== "menu") {
      return [];
    }

    if (choice === "instructions") {
      this.state = "instructions";
      return [];
    }

    this.state = "intro";
    return ["begin"];
  }

  public toggleLanguage(): void {
    this.language = this.language === "sv" ? "en" : "sv";
    this.saveLanguage();
  }

  public returnToMenu(): GameEvent[] {
    if (this.state === "menu") {
      return [];
    }

    this.resetRun();
    this.state = "menu";
    return ["menu"];
  }

  public update(deltaSeconds: number): GameEvent[] {
    if (this.state === "game-over") {
      this.player.deathTime += deltaSeconds;
      return [];
    }

    if (this.state !== "playing") {
      return [];
    }

    const events: GameEvent[] = [];
    this.distance += RUN_SPEED * deltaSeconds;
    this.player.animationTime += deltaSeconds;
    const previousBottom = this.player.y + PLAYER_HEIGHT / 2;
    this.player.velocityY += GRAVITY * deltaSeconds;
    this.player.y += this.player.velocityY * deltaSeconds;
    this.player.grounded = false;

    for (const obstacle of this.obstacles) {
      obstacle.x -= RUN_SPEED * deltaSeconds;

      if (!obstacle.scored && this.player.x > obstacle.x + obstacle.width / 2) {
        obstacle.scored = true;
        this.addScore();
      }

      if (obstacle.coinAvailable && !obstacle.coinCollected && this.collidesWithCoin(obstacle)) {
        obstacle.coinCollected = true;
        this.addScore();
        events.push("coin");
      }

      if (this.collidesWithObstacle(obstacle)) {
        events.push(...this.die());
        return events;
      }
    }

    let landedOnPlatform = false;
    for (const platform of this.landingPlatforms) {
      platform.x -= RUN_SPEED * deltaSeconds;
      landedOnPlatform = this.landOnPlatform(platform, previousBottom) || landedOnPlatform;
    }

    const groundTop = GROUND_Y - PLAYER_HEIGHT / 2;
    if (this.player.y >= groundTop) {
      this.player.y = groundTop;
      this.player.velocityY = 0;
      this.player.grounded = true;
      this.player.flapCount = 0;
    } else if (!landedOnPlatform) {
      this.player.grounded = false;
    }

    const firstObstacle = this.obstacles[0];
    const lastObstacle = this.obstacles[this.obstacles.length - 1];
    if (firstObstacle && lastObstacle && firstObstacle.x < -firstObstacle.width) {
      this.obstacles.shift();
      this.obstacles.push(this.createObstacle(lastObstacle.x + OBSTACLE_DISTANCE));
    }

    const firstLandingPlatform = this.landingPlatforms[0];
    const lastLandingPlatform = this.landingPlatforms[this.landingPlatforms.length - 1];
    if (firstLandingPlatform && lastLandingPlatform && firstLandingPlatform.x < -firstLandingPlatform.width) {
      this.landingPlatforms.shift();
      this.landingPlatforms.push(this.createLandingPlatform(lastLandingPlatform.x + LANDING_PLATFORM_DISTANCE));
    }

    return events;
  }

  public get playerBounds(): Rect {
    return {
      x: this.player.x - PLAYER_WIDTH / 2 + 12,
      y: this.player.y - PLAYER_HEIGHT / 2 + 9,
      width: PLAYER_WIDTH - 24,
      height: PLAYER_HEIGHT - 18,
    };
  }

  public get coinPosition(): (obstacle: Obstacle) => { x: number; y: number } {
    return (obstacle) => ({ x: obstacle.x + OBSTACLE_DISTANCE / 2, y: obstacle.gapCenter + obstacle.coinYOffset });
  }

  private resetRun(): void {
    const player = this.createPlayer();
    Object.assign(this.player, player);
    this.score = 0;
    this.distance = 0;
    this.randomState = 0x4c4f4f50;
    this.lastLandingPlatformTop = -1;
    this.obstacles = [
      this.createObstacle(FIRST_OBSTACLE_X),
      this.createObstacle(FIRST_OBSTACLE_X + OBSTACLE_DISTANCE),
      this.createObstacle(FIRST_OBSTACLE_X + OBSTACLE_DISTANCE * 2),
    ];
    this.landingPlatforms = [
      this.createLandingPlatform(FIRST_LANDING_PLATFORM_X),
      this.createLandingPlatform(FIRST_LANDING_PLATFORM_X + LANDING_PLATFORM_DISTANCE),
    ];
  }

  private createPlayer(): Player {
    return {
      x: 238,
      y: GROUND_Y - PLAYER_HEIGHT / 2,
      velocityY: 0,
      flapCount: 0,
      grounded: true,
      dead: false,
      animationTime: 0,
      deathTime: 0,
    };
  }

  private createObstacle(x: number): Obstacle {
    return {
      x,
      gapCenter: this.randomBetween(342, 416),
      gapHeight: this.randomBetween(332, 366),
      width: OBSTACLE_WIDTH,
      coinAvailable: this.randomBetween(0, 1) < COIN_SPAWN_CHANCE,
      scored: false,
      coinCollected: false,
      coinYOffset: this.randomBetween(-14, 14),
    };
  }

  private collidesWithObstacle(obstacle: Obstacle): boolean {
    const player = this.playerBounds;
    const left = obstacle.x - OBSTACLE_HIT_WIDTH / 2;
    const right = obstacle.x + OBSTACLE_HIT_WIDTH / 2;
    const horizontalOverlap = player.x + player.width > left && player.x < right;
    if (!horizontalOverlap) {
      return false;
    }

    const gapTop = obstacle.gapCenter - obstacle.gapHeight / 2 - OBSTACLE_GAP_PADDING;
    const gapBottom = obstacle.gapCenter + obstacle.gapHeight / 2 + OBSTACLE_GAP_PADDING;
    return player.y < gapTop || player.y + player.height > gapBottom;
  }

  private landOnPlatform(platform: LandingPlatform, previousBottom: number): boolean {
    if (this.player.velocityY < 0 || previousBottom > platform.top) {
      return false;
    }

    const playerLeft = this.player.x - PLAYER_WIDTH / 2 + 12;
    const playerRight = this.player.x + PLAYER_WIDTH / 2 - 12;
    const platformLeft = platform.x - platform.width / 2 + 12;
    const platformRight = platform.x + platform.width / 2 - 12;
    const currentBottom = this.player.y + PLAYER_HEIGHT / 2;
    const overlapsPlatform = playerRight > platformLeft && playerLeft < platformRight;

    if (!overlapsPlatform || currentBottom < platform.top) {
      return false;
    }

    this.player.y = platform.top - PLAYER_HEIGHT / 2;
    this.player.velocityY = 0;
    this.player.grounded = true;
    this.player.flapCount = 0;
    return true;
  }

  private collidesWithCoin(obstacle: Obstacle): boolean {
    const coin = this.coinPosition(obstacle);
    const player = this.playerBounds;
    const closestX = Math.max(player.x, Math.min(coin.x, player.x + player.width));
    const closestY = Math.max(player.y, Math.min(coin.y, player.y + player.height));
    const deltaX = coin.x - closestX;
    const deltaY = coin.y - closestY;
    return deltaX * deltaX + deltaY * deltaY < 28 * 28;
  }

  private createLandingPlatform(x: number): LandingPlatform {
    const tops = [552, 508, 466];
    const availableTops = tops.filter((top) => top !== this.lastLandingPlatformTop);
    const top = availableTops[Math.floor(this.randomBetween(0, availableTops.length))];
    this.lastLandingPlatformTop = top;
    return { x, top, width: LANDING_PLATFORM_WIDTH, height: LANDING_PLATFORM_HEIGHT };
  }

  private die(): GameEvent[] {
    this.player.dead = true;
    this.player.deathTime = 0;
    this.state = "game-over";
    return ["death"];
  }

  private addScore(): void {
    this.score += 1;
  }

  private randomBetween(min: number, max: number): number {
    this.randomState = (this.randomState * 1_664_525 + 1_013_904_223) >>> 0;
    return min + (this.randomState / 0x1_0000_0000) * (max - min);
  }

  private readLanguage(): Language {
    try {
      return localStorage.getItem("cosmic-run-language") === "en" ? "en" : "sv";
    } catch {
      return "sv";
    }
  }

  private saveLanguage(): void {
    try {
      localStorage.setItem("cosmic-run-language", this.language);
    } catch {
      // Local storage may be unavailable in restricted browser contexts.
    }
  }
}
