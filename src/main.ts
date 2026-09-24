import "./styles.css";
import { audioPaths, loadOriginalAssets } from "./assets";
import { CosmicRunGame, type GameEvent } from "./game";
import {
  LEADERBOARD_LIMIT,
  getLocalHighscores,
  loadHighscores,
  normalizeName,
  submitHighscore,
  type HighscoreEntry,
  type HighscoreSource,
} from "./highscores";
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
const leaderboardList = findElement<HTMLOListElement>("#leaderboard-list");
const leaderboardTitle = findElement<HTMLElement>("#leaderboard-title");
const playerNameUi = findElement<HTMLElement>("#player-name-ui");
const playerChoice = findElement<HTMLElement>("#player-choice");
const playerNameFormPanel = findElement<HTMLElement>("#player-name-form-panel");
const resumePlayerButton = findElement<HTMLButtonElement>("#resume-player-button");
const resumePlayerName = findElement<HTMLElement>("#resume-player-name");
const newPlayerButton = findElement<HTMLButtonElement>("#new-player-button");
const playerNameForm = findElement<HTMLFormElement>("#player-name-form");
const playerNameInput = findElement<HTMLInputElement>("#player-name");
const playerNameStatus = findElement<HTMLElement>("#player-name-status");
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
  let previousState = game.state;
  let playerName = "";
  let scoreSubmissionId = 0;
  let leaderboardEntries: HighscoreEntry[] = getLocalHighscores().slice(0, LEADERBOARD_LIMIT);
  let leaderboardSource: HighscoreSource = "local";

  function renderLeaderboard(): void {
    const text = copy[game.language];
    leaderboardList.replaceChildren();
    leaderboardTitle.textContent = leaderboardSource === "online" ? text.globalLeaderboard : text.yourHighestScores;

    if (leaderboardEntries.length === 0) {
      const emptyRow = document.createElement("li");
      emptyRow.className = "leaderboard-empty";
      emptyRow.textContent = text.noScores;
      leaderboardList.append(emptyRow);
      return;
    }

    for (const [index, entry] of leaderboardEntries.entries()) {
      const row = document.createElement("li");
      row.className = "leaderboard-row";

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `${index + 1}.`;

      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.name;

      const score = document.createElement("strong");
      score.className = "leaderboard-score";
      score.textContent = String(entry.score);

      row.append(rank, name, score);
      leaderboardList.append(row);
    }
  }

  async function refreshLeaderboard(): Promise<void> {
    const result = await loadHighscores();
    leaderboardEntries = result.entries;
    leaderboardSource = result.source;
    renderLeaderboard();
  }

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

    languageButton.dataset.activeLanguage = game.language;
    languageButton.setAttribute("aria-label", text.languageAria);
  }

  function syncMenuVisibility(): void {
    menuUi.hidden = game.state !== "menu" || !playerNameUi.hidden;
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
    if (game.state === "menu") {
      showPlayerMenu();
      return;
    }

    playEvents(game.pressAction());
  }

  function showPlayerNameEntry(): void {
    playerNameUi.hidden = false;
    playerChoice.hidden = true;
    playerNameFormPanel.hidden = false;
    playerNameInput.value = playerName;
    playerNameStatus.textContent = "";
    syncMenuVisibility();
    window.setTimeout(() => playerNameInput.focus(), 0);
  }

  function showPlayerMenu(): void {
    if (!playerName) {
      showPlayerNameEntry();
      return;
    }

    playerNameUi.hidden = false;
    playerChoice.hidden = false;
    playerNameFormPanel.hidden = true;
    resumePlayerName.textContent = playerName;
    resumePlayerButton.setAttribute("aria-label", `${copy[game.language].resumeAs} ${playerName}`);
    syncMenuVisibility();
    window.setTimeout(() => resumePlayerButton.focus(), 0);
  }

  function hidePlayerNameEntry(): void {
    playerNameUi.hidden = true;
    playerChoice.hidden = true;
    playerNameFormPanel.hidden = false;
    syncMenuVisibility();
  }

  async function saveCurrentScore(): Promise<void> {
    if (!playerName) {
      return;
    }

    const submissionId = ++scoreSubmissionId;
    const result = await submitHighscore(playerName, game.score);
    if (submissionId !== scoreSubmissionId) {
      return;
    }

    leaderboardEntries = result.entries;
    leaderboardSource = result.source;
    renderLeaderboard();
  }

  function syncGameState(): void {
    const enteringGameOver = previousState !== "game-over" && game.state === "game-over";
    if (enteringGameOver) {
      void saveCurrentScore();
    }

    previousState = game.state;
  }

  playButton.addEventListener("click", () => {
    showPlayerMenu();
  });

  instructionsButton.addEventListener("click", () => {
    playEvents(game.selectMenu("instructions"));
  });

  languageButton.addEventListener("click", () => {
    game.toggleLanguage();
    updateInterface();
    renderLeaderboard();
  });

  resumePlayerButton.addEventListener("click", () => {
    hidePlayerNameEntry();
    playEvents(game.selectMenu("play"));
  });

  newPlayerButton.addEventListener("click", () => {
    showPlayerNameEntry();
    playerNameInput.value = "";
  });

  playerNameForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = normalizeName(playerNameInput.value);
    if (!name) {
      playerNameStatus.textContent = copy[game.language].nameRequired;
      playerNameInput.focus();
      return;
    }

    playerName = name;
    playerNameInput.value = name;
    hidePlayerNameEntry();
    playEvents(game.selectMenu("play"));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault();
      if (!playerNameUi.hidden) {
        hidePlayerNameEntry();
        return;
      }

      playEvents(game.returnToMenu());
      return;
    }

    if (event.code !== "Space") {
      return;
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) {
      return;
    }

    if (!playerNameUi.hidden) {
      return;
    }

    event.preventDefault();
    action();
  });

  gameCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (game.state === "menu" || !playerNameUi.hidden) {
      return;
    }

    action();
  });

  function frame(now: number): void {
    const deltaSeconds = previousTime === undefined ? 0 : Math.min(Math.max((now - previousTime) / 1_000, 0), 0.05);
    previousTime = now;
    elapsedSeconds += deltaSeconds;
    playEvents(game.update(deltaSeconds));
    syncGameState();
    renderer.render(game, elapsedSeconds);
    updateInterface();
    syncMenuVisibility();
    gameCanvas.dataset.state = game.state;
    gameCanvas.dataset.playerY = String(Math.round(game.player.y));
    gameCanvas.dataset.score = String(game.score);
    const scoreLabel = game.language === "sv" ? "poäng" : "score";
    gameCanvas.setAttribute("aria-label", `Cosmic Run: ${game.state}, ${scoreLabel} ${game.score}`);
    requestAnimationFrame(frame);
  }

  updateInterface();
  renderLeaderboard();
  syncMenuVisibility();
  void refreshLeaderboard();
  requestAnimationFrame(frame);
}

void bootstrap().catch((error: unknown) => {
  statusText.textContent = error instanceof Error ? error.message : "Cosmic Run kunde inte starta.";
});
