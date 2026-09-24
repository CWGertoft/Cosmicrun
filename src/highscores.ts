export const MAX_NAME_LENGTH = 16;
export const LEADERBOARD_LIMIT = 3;

const LOCAL_HIGHSCORES_KEY = "cosmic-run-highscores";
const MAX_LOCAL_SCORES = 10;
const REQUEST_TIMEOUT_MS = 6_000;
const apiUrl = (import.meta.env.VITE_HIGHSCORE_API_URL?.trim() || "/api/highscores").replace(/\/+$/, "");

export interface HighscoreEntry {
  name: string;
  score: number;
  createdAt?: string;
}

export type HighscoreSource = "online" | "local";

export interface HighscoreResult {
  entries: HighscoreEntry[];
  source: HighscoreSource;
  error?: string;
}

interface ApiResponse {
  scores?: unknown;
}

export function normalizeName(value: string): string {
  const withoutUnsupportedCharacters = value
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return Array.from(withoutUnsupportedCharacters).slice(0, MAX_NAME_LENGTH).join("");
}

export function getLocalHighscores(): HighscoreEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_HIGHSCORES_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortEntries(parsed.filter(isHighscoreEntry)).slice(0, MAX_LOCAL_SCORES);
  } catch {
    return [];
  }
}

export function rememberLocalScore(name: string, score: number): HighscoreEntry[] {
  const normalizedName = normalizeName(name);
  if (!normalizedName || !Number.isSafeInteger(score) || score < 0) {
    return getLocalHighscores();
  }

  const entries = sortEntries([
    ...getLocalHighscores(),
    {
      name: normalizedName,
      score,
      createdAt: new Date().toISOString(),
    },
  ]).slice(0, MAX_LOCAL_SCORES);

  try {
    localStorage.setItem(LOCAL_HIGHSCORES_KEY, JSON.stringify(entries));
  } catch {
    // The in-memory result is still useful when localStorage is unavailable.
  }

  return entries;
}

export async function loadHighscores(): Promise<HighscoreResult> {
  try {
    const payload = await requestApi("");
    return {
      entries: parseEntries(payload.scores).slice(0, LEADERBOARD_LIMIT),
      source: "online",
    };
  } catch (error: unknown) {
    return {
      entries: getLocalHighscores().slice(0, LEADERBOARD_LIMIT),
      source: "local",
      error: error instanceof Error ? error.message : "Highscore kunde inte hämtas.",
    };
  }
}

export async function submitHighscore(name: string, score: number): Promise<HighscoreResult> {
  const normalizedName = normalizeName(name);
  const localEntries = rememberLocalScore(normalizedName, score);

  if (!normalizedName) {
    return {
      entries: localEntries.slice(0, LEADERBOARD_LIMIT),
      source: "local",
      error: "Skriv in ett namn.",
    };
  }

  try {
    const payload = await requestApi("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName, score }),
    });

    return {
      entries: parseEntries(payload.scores).slice(0, LEADERBOARD_LIMIT),
      source: "online",
    };
  } catch (error: unknown) {
    return {
      entries: localEntries.slice(0, LEADERBOARD_LIMIT),
      source: "local",
      error: error instanceof Error ? error.message : "Online-highscore är inte tillgänglig.",
    };
  }
}

async function requestApi(path: string, init?: RequestInit): Promise<ApiResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });

    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Highscore-API svarade med ${response.status}.`);
    }

    if (!isApiResponse(payload) || !Array.isArray(payload.scores)) {
      throw new Error("Highscore-API:t är inte tillgängligt på den här adressen.");
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function parseEntries(value: unknown): HighscoreEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return sortEntries(value.filter(isHighscoreEntry));
}

function isApiResponse(value: unknown): value is ApiResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHighscoreEntry(value: unknown): value is HighscoreEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<HighscoreEntry>;
  const score = candidate.score;
  return (
    typeof candidate.name === "string" &&
    normalizeName(candidate.name) === candidate.name &&
    candidate.name.length > 0 &&
    candidate.name.length <= MAX_NAME_LENGTH &&
    typeof score === "number" &&
    Number.isSafeInteger(score) &&
    score >= 0
  );
}

function sortEntries(entries: HighscoreEntry[]): HighscoreEntry[] {
  return [...entries].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  });
}
