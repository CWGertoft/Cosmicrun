import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PLAYER_HEIGHT, PLAYER_WIDTH, type CosmicRunGame } from "./game";
import { copy } from "./i18n";
import type { OriginalAssets } from "./assets";
import type { LandingPlatform, Obstacle } from "./types";

const GATE_SOURCE_X = 3_100;
const GATE_SOURCE_WIDTH = 1_950;
const GATE_SOURCE_HEIGHT = 6_667;
const OBSTACLE_RENDER_HEIGHT = GAME_HEIGHT + 110;

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
}

interface Starfall {
  startTime: number;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  brightness: number;
  tailLength: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stars: Star[];
  private nextStarfallAt = 3.5;
  private activeStarfall: Starfall | null = null;

  public constructor(canvas: HTMLCanvasElement, private readonly assets: OriginalAssets) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D stöds inte av den här webbläsaren.");
    }

    this.ctx = ctx;
    this.stars = this.createStars();
  }

  public render(game: CosmicRunGame, elapsedSeconds: number): void {
    this.drawSpace(game.distance, elapsedSeconds);

    if (game.state === "menu") {
      return;
    }

    if (game.state === "instructions") {
      this.drawInstructions(game);
      return;
    }

    this.drawWorld(game, elapsedSeconds);
    this.drawHud(game);

    if (game.state === "intro") {
      this.drawIntro(game);
    }

    if (game.state === "game-over") {
      this.drawGameOver(game);
    }
  }

  private drawSpace(distance: number, elapsedSeconds: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#01050d";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const star = this.assets.get("star");
    for (const item of this.stars) {
      const x = (item.x - distance * item.speed + GAME_WIDTH + 80) % (GAME_WIDTH + 80) - 40;
      const shimmer = 0.58 + (Math.sin(elapsedSeconds * (1.2 + item.speed * 8) + item.phase) + 1) * 0.21;
      ctx.globalAlpha = (0.24 + item.size / 36) * shimmer;
      ctx.shadowColor = "rgba(95, 219, 255, 0.8)";
      ctx.shadowBlur = item.size * (0.18 + shimmer * 0.18);
      ctx.drawImage(star, x, item.y, item.size, item.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    this.drawStarfall(elapsedSeconds);
  }

  private drawStarfall(elapsedSeconds: number): void {
    if (this.activeStarfall && elapsedSeconds >= this.activeStarfall.startTime + this.activeStarfall.duration) {
      this.activeStarfall = null;
      this.nextStarfallAt = elapsedSeconds + 7.5 + Math.random() * 5;
    }

    if (!this.activeStarfall && elapsedSeconds >= this.nextStarfallAt) {
      this.activeStarfall = this.createStarfall(elapsedSeconds);
    }

    const starfall = this.activeStarfall;
    if (!starfall) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (elapsedSeconds - starfall.startTime) / starfall.duration));
    const easedProgress = progress * progress * (3 - 2 * progress);
    const deltaX = starfall.endX - starfall.startX;
    const deltaY = starfall.endY - starfall.startY;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const headX = starfall.startX + deltaX * easedProgress;
    const headY = starfall.startY + deltaY * easedProgress;
    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const tailX = headX - directionX * starfall.tailLength;
    const tailY = headY - directionY * starfall.tailLength;
    const visibility = Math.sin(progress * Math.PI) * starfall.brightness;
    const { ctx } = this;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(74, 218, 255, 0.95)";
    ctx.shadowBlur = 18 * starfall.size;

    const glow = ctx.createLinearGradient(tailX, tailY, headX, headY);
    glow.addColorStop(0, "rgba(80, 214, 255, 0)");
    glow.addColorStop(0.55, `rgba(80, 214, 255, ${0.18 * visibility})`);
    glow.addColorStop(1, `rgba(194, 249, 255, ${0.9 * visibility})`);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 22 * starfall.size;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.shadowBlur = 6 * starfall.size;
    ctx.strokeStyle = `rgba(239, 255, 255, ${0.95 * visibility})`;
    ctx.lineWidth = 5 * starfall.size;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.shadowBlur = 14 * starfall.size;
    ctx.fillStyle = `rgba(255, 255, 255, ${visibility})`;
    ctx.beginPath();
    ctx.arc(headX, headY, 8 * starfall.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private createStarfall(startTime: number): Starfall {
    const margin = 180;
    const lane = Math.random();
    const direction = Math.floor(Math.random() * 5);
    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;

    if (direction === 0) {
      // From the left, falling towards the right.
      startX = -margin;
      startY = 70 + lane * 250;
      endX = GAME_WIDTH + margin;
      endY = startY + 130 + Math.random() * 180;
    } else if (direction === 1) {
      // From the right, falling towards the left.
      startX = GAME_WIDTH + margin;
      startY = 70 + lane * 250;
      endX = -margin;
      endY = startY + 130 + Math.random() * 180;
    } else if (direction === 2) {
      // From above on the left, cutting down towards the right.
      startX = 80 + lane * 450;
      startY = -margin;
      endX = startX + 560 + Math.random() * 400;
      endY = GAME_HEIGHT + margin;
    } else if (direction === 3) {
      // From above on the right, cutting down towards the left.
      startX = GAME_WIDTH - 80 - lane * 450;
      startY = -margin;
      endX = startX - 560 - Math.random() * 400;
      endY = GAME_HEIGHT + margin;
    } else {
      // A rarer upward streak from the lower left to the upper right.
      startX = -margin;
      startY = GAME_HEIGHT - 90 - lane * 190;
      endX = GAME_WIDTH + margin;
      endY = -margin;
    }

    // A larger/brighter star is closer; a smaller/dimmer one reads as distant.
    const depth = 0.25 + Math.random() * 0.75;
    const size = 0.58 + depth * 0.82;
    const brightness = 0.48 + depth * 0.52;

    return {
      startTime,
      duration: 0.78 + Math.random() * 0.38 + depth * 0.12,
      startX,
      startY,
      endX,
      endY,
      size,
      brightness,
      tailLength: 150 + size * 105,
    };
  }

  private drawWorld(game: CosmicRunGame, elapsedSeconds: number): void {
    const { ctx } = this;
    const station = this.assets.get("station");
    const city = this.assets.get("city");
    const constellation = this.assets.get("constellation");
    const parallax = game.distance * 0.12;

    ctx.globalAlpha = 0.22;
    this.drawRepeated(station, 460, 250, 510, -parallax, 370);
    ctx.globalAlpha = 0.14;
    this.drawRepeated(city, 420, 200, 480, -parallax * 0.7, 420);
    ctx.globalAlpha = 0.08;
    ctx.drawImage(constellation, 860 - (parallax % 980), 30, 400, 300);
    ctx.globalAlpha = 1;

    for (const obstacle of game.obstacles) {
      this.drawObstacle(obstacle);
      if (obstacle.coinAvailable && !obstacle.coinCollected) {
        this.drawCoin(game.coinPosition(obstacle), elapsedSeconds);
      }
    }

    for (const platform of game.landingPlatforms) {
      this.drawLandingPlatform(platform);
    }

    this.drawGround();
    this.drawPlayer(game, elapsedSeconds);
  }

  private drawObstacle(obstacle: Obstacle): void {
    const { ctx } = this;
    const gateImage = this.assets.get("gate-green");

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(
      gateImage,
      GATE_SOURCE_X,
      0,
      GATE_SOURCE_WIDTH,
      GATE_SOURCE_HEIGHT,
      obstacle.x - obstacle.width / 2,
      obstacle.gapCenter - OBSTACLE_RENDER_HEIGHT / 2,
      obstacle.width,
      OBSTACLE_RENDER_HEIGHT,
    );
    ctx.restore();
  }

  private drawCoin(position: { x: number; y: number }, elapsedSeconds: number): void {
    const frame = (Math.floor(elapsedSeconds * 12) % 7) + 1;
    const image = this.assets.get(`coin-${frame}`);
    const size = 105;
    this.ctx.drawImage(image, position.x - size / 2, position.y - size / 2, size, size * 0.84);
  }

  private drawLandingPlatform(platform: LandingPlatform): void {
    const pillar = this.assets.get("pillar-cyan");
    this.ctx.globalAlpha = 0.8;
    this.ctx.drawImage(
      pillar,
      3_220,
      5_050,
      1_600,
      1_300,
      platform.x - platform.width / 2,
      platform.top - 8,
      platform.width,
      platform.height,
    );
    this.ctx.globalAlpha = 1;
  }

  private drawGround(): void {
    const { ctx } = this;

    ctx.fillStyle = "#032039";
    ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    ctx.fillStyle = "#0a75b7";
    ctx.fillRect(0, GROUND_Y - 8, GAME_WIDTH, 8);
    ctx.fillStyle = "rgba(113, 225, 255, 0.16)";
    ctx.fillRect(0, GROUND_Y + 8, GAME_WIDTH, 2);
  }

  private drawPlayer(game: CosmicRunGame, elapsedSeconds: number): void {
    const player = game.player;
    const image = this.playerFrame(game, elapsedSeconds);
    const width = PLAYER_WIDTH * 1.95;
    const height = width * (image.naturalHeight / image.naturalWidth);
    const isAirborne = !player.grounded && !player.dead;
    const tilt = player.dead ? 0 : Math.max(-0.16, Math.min(0.18, player.velocityY / 2_200));
    const bob = player.grounded ? Math.sin(elapsedSeconds * 15) * 1.8 : 0;

    if (player.grounded) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = "#00121f";
      this.ctx.beginPath();
      this.ctx.ellipse(player.x, player.y + PLAYER_HEIGHT / 2 + 5, width * 0.31, 7, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.translate(player.x, player.y + bob);
    this.ctx.rotate(tilt);
    if (isAirborne) {
      this.ctx.globalAlpha = 0.16;
      this.ctx.drawImage(image, -width / 2 - player.velocityY * 0.012, -height / 2 + 5, width, height);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.shadowColor = player.dead ? "rgba(255, 90, 126, 0.45)" : "rgba(86, 219, 255, 0.72)";
    this.ctx.shadowBlur = player.dead ? 10 : 15;
    this.ctx.drawImage(image, -width / 2, -height / 2, width, height);
    this.ctx.restore();
  }

  private playerFrame(game: CosmicRunGame, elapsedSeconds: number): HTMLImageElement {
    if (game.player.dead) {
      return this.assets.get(`death-${Math.min(7, Math.floor(game.player.deathTime * 10) + 1)}`);
    }

    if (!game.player.grounded) {
      const jumpFrame = (Math.floor(game.player.animationTime * 12) % 6) + 1;
      return this.assets.get(`jump-${jumpFrame}`);
    }

    const runFrame = (Math.floor(elapsedSeconds * 12) % 9) + 1;
    return this.assets.get(`run-${runFrame}`);
  }

  private drawHud(game: CosmicRunGame): void {
    const { ctx } = this;
    const text = copy[game.language];
    ctx.textAlign = "left";
    ctx.fillStyle = "#dffcff";
    ctx.font = "36px Cosmic, Impact, sans-serif";
    ctx.fillText(String(game.score), 42, 70);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9fefff";
    ctx.font = "16px Cosmic, Impact, sans-serif";
    ctx.fillText(text.escHud, GAME_WIDTH - 38, 54);
  }

  private drawInstructions(game: CosmicRunGame): void {
    const { ctx } = this;
    const text = copy[game.language];
    ctx.fillStyle = "rgba(0, 9, 20, 0.84)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7feff";
    ctx.font = "52px Cosmic, Impact, sans-serif";
    ctx.fillText(text.instructions, GAME_WIDTH / 2, 170);
    ctx.font = "25px Cosmic, Impact, sans-serif";
    ctx.fillText(text.jump, GAME_WIDTH / 2, 270);
    ctx.fillText(text.air, GAME_WIDTH / 2, 322);
    ctx.fillText(text.openings, GAME_WIDTH / 2, 374);
    ctx.fillText(text.platforms, GAME_WIDTH / 2, 426);
    ctx.font = "19px Cosmic, Impact, sans-serif";
    ctx.fillStyle = "#9fefff";
    ctx.fillText(text.back, GAME_WIDTH / 2, 540);
  }

  private drawIntro(game: CosmicRunGame): void {
    const { ctx } = this;
    const text = copy[game.language];
    ctx.fillStyle = "rgba(0, 9, 20, 0.78)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7feff";
    ctx.font = "48px Cosmic, Impact, sans-serif";
    ctx.fillText("COSMIC RUN", GAME_WIDTH / 2, 282);
    ctx.font = "28px Cosmic, Impact, sans-serif";
    ctx.fillText(text.start, GAME_WIDTH / 2, 348);
    ctx.font = "20px Cosmic, Impact, sans-serif";
    ctx.fillStyle = "#9fefff";
    ctx.fillText(text.air, GAME_WIDTH / 2, 390);
    ctx.fillText(text.avoid, GAME_WIDTH / 2, 424);
  }

  private drawGameOver(game: CosmicRunGame): void {
    const { ctx } = this;
    const text = copy[game.language];
    ctx.fillStyle = "rgba(0, 4, 11, 0.78)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "58px Cosmic, Impact, sans-serif";
    ctx.fillText("GAME OVER", GAME_WIDTH / 2, 286);
    ctx.font = "30px Cosmic, Impact, sans-serif";
    ctx.fillText(`${text.score} ${game.score}`, GAME_WIDTH / 2, 344);
    ctx.font = "22px Cosmic, Impact, sans-serif";
    ctx.fillStyle = "#9fefff";
    ctx.fillText(text.restart, GAME_WIDTH / 2, 404);
    ctx.fillText(text.escBack, GAME_WIDTH / 2, 438);
  }

  private drawRepeated(image: HTMLImageElement, width: number, height: number, step: number, offset: number, y: number): void {
    for (let x = offset - step; x < GAME_WIDTH + step; x += step) {
      this.ctx.drawImage(image, x, y, width, height);
    }
  }

  private createStars(): Star[] {
    const stars: Star[] = [];
    let seed = 0x434f534d;
    for (let index = 0; index < 62; index += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      const x = (seed / 0x1_0000_0000) * GAME_WIDTH;
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      const y = (seed / 0x1_0000_0000) * (GROUND_Y - 32) + 16;
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      const size = 5 + (seed % 11);
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      stars.push({
        x,
        y,
        size,
        speed: 0.04 + (seed % 7) * 0.012,
        phase: (seed / 0x1_0000_0000) * Math.PI * 2,
      });
    }

    return stars;
  }
}
