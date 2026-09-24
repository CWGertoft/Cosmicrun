import "./styles.css";
import { audioPaths, loadOriginalAssets } from "./assets";
import { CosmicRunGame, type GameEvent } from "./game";
import { copy } from "./i18n";
import { Renderer } from "./renderer";

class GameAudio {
  private readonly music = new Audio(audioPaths.music);

  public constructor() {
    this.music.loop = true;
    this.music.volume = 0.32;
  }

  public beginMusic(): void {
    void this.music.play().catch(() => {
      // Browsers can reject playback until a later user gesture.
    });
  }

  public returnToMenu(): void {
    this.music.pause();
    this.music.currentTime = 0;
  }

  public playCoin(): void {
    this.playEffect(audioPaths.coin, 0.45);
  }

  public playDeath(): void {
    this.playEffect(audioPaths.hit, 0.6);
  }

  private playEffect(path: string, volume: number): void {
    const effect = new Audio(path);
    effect.volume = volume;
    void effect.play().catch(() => {
      // Missing audio support must not stop the game loop.
    });
  }
}

function findElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Kunde inte hitta ${selector}.`);
  }

  return element;
}

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const status = document.querySelector<HTMLElement>("#status");

if (!canvas || !status) {
  throw new Error("Kunde inte starta Cosmic Run.");
}

const gameCanvas = canvas;
const statusText = status;
const menuUi = findElement<HTMLElement>("#menu-ui");
const playButton = findElement<HTMLButtonElement>("#play-button");
const instructionsButton = findElement<HTMLButtonElement>("#instructions-button");
const languageButton = findElement<HTMLButtonElement>("#language-button");
const highScoreLabel = findElement<HTMLElement>("#high-score-label");
const translatedElements = Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"));

async function bootstrap(): Promise<void> {
  const assets = await loadOriginalAssets((loaded, total) => {
    statusText.textContent = `Laddar originalassets… ${loaded}/${total}`;
  });

  const game = new CosmicRunGame();
  const renderer = new Renderer(gameCanvas, assets);
  const audio = new GameAudio();
  let previousTime: number | undefined;
  let elapsedSeconds = 0;

  statusText.hidden = true;

  function updateInterface(): void {
    const text = copy[game.language];
    document.documentElement.lang = game.language;

    for (const element of translatedElements) {
      const key = element.dataset.i18n;
      if (!key) {
        continue;
      }

      const value = text[key as keyof typeof text];
      if (value) {
        element.textContent = value;
      }
    }

    highScoreLabel.textContent = `${text.highScore}: ${game.highScore}`;
    languageButton.dataset.activeLanguage = game.language;
    languageButton.setAttribute("aria-label", text.languageAria);
  }

  function syncMenuVisibility(): void {
    menuUi.hidden = game.state !== "menu";
  }

  function playEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event === "begin") {
        audio.beginMusic();
      } else if (event === "menu") {
        audio.returnToMenu();
      } else if (event === "coin") {
        audio.playCoin();
      } else if (event === "death") {
        audio.playDeath();
      }
    }
  }

  function action(): void {
    playEvents(game.pressAction());
  }

  playButton.addEventListener("click", () => {
    playEvents(game.selectMenu("play"));
  });

  instructionsButton.addEventListener("click", () => {
    playEvents(game.selectMenu("instructions"));
  });

  languageButton.addEventListener("click", () => {
    game.toggleLanguage();
    updateInterface();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault();
      playEvents(game.returnToMenu());
      return;
    }

    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();
    action();
  });

  gameCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (game.state === "menu") {
      return;
    }

    action();
  });

  function frame(now: number): void {
    const deltaSeconds = previousTime === undefined ? 0 : Math.min(Math.max((now - previousTime) / 1_000, 0), 0.05);
    previousTime = now;
    elapsedSeconds += deltaSeconds;
    playEvents(game.update(deltaSeconds));
    renderer.render(game, elapsedSeconds);
    updateInterface();
    syncMenuVisibility();
    gameCanvas.dataset.state = game.state;
    gameCanvas.dataset.playerY = String(Math.round(game.player.y));
    gameCanvas.dataset.score = String(game.score);
    const scoreLabel = game.language === "sv" ? "poäng" : "score";
    const highScoreText = game.language === "sv" ? "högsta poäng" : "high score";
    gameCanvas.setAttribute("aria-label", `Cosmic Run: ${game.state}, ${scoreLabel} ${game.score}, ${highScoreText} ${game.highScore}`);
    requestAnimationFrame(frame);
  }

  updateInterface();
  syncMenuVisibility();
  requestAnimationFrame(frame);
}

void bootstrap().catch((error: unknown) => {
  statusText.textContent = error instanceof Error ? error.message : "Cosmic Run kunde inte starta.";
});
