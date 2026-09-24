import { MongoClient, type Collection } from "mongodb";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 1_000_000;
const LEADERBOARD_LIMIT = 3;

interface ScoreDocument {
  name: string;
  score: number;
  createdAt: Date;
}

interface HighscoreBody {
  name?: unknown;
  score?: unknown;
}

const globalForMongo = globalThis as typeof globalThis & {
  cosmogramMongoClient?: Promise<MongoClient>;
};

let collectionPromise: Promise<Collection<ScoreDocument>> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const collection = await getCollection();

    if (req.method === "GET") {
      res.status(200).json({ scores: await getTopScores(collection) });
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const name = validateName(body?.name);
      const score = validateScore(body?.score);

      if (!name || score === null) {
        res.status(400).json({ error: "Ogiltigt namn eller poäng." });
        return;
      }

      await collection.insertOne({ name, score, createdAt: new Date() });
      res.status(201).json({ scores: await getTopScores(collection) });
      return;
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(405).json({ error: "Metoden stöds inte." });
  } catch (error: unknown) {
    console.error("Highscore API error", error);
    res.status(503).json({ error: "Highscore-databasen är tillfälligt otillgänglig." });
  }
}

async function getCollection(): Promise<Collection<ScoreDocument>> {
  if (!collectionPromise) {
    const mongoUri = process.env.MONGODB_URI?.trim();
    if (!mongoUri) {
      throw new Error("MONGODB_URI saknas.");
    }

    const nextCollectionPromise = (async () => {
      if (!globalForMongo.cosmogramMongoClient) {
        globalForMongo.cosmogramMongoClient = new MongoClient(mongoUri, {
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 5_000,
        }).connect();
      }

      const client = await globalForMongo.cosmogramMongoClient;
      const database = client.db(process.env.MONGODB_DB_NAME?.trim() || "cosmogram");
      const collection = database.collection<ScoreDocument>(process.env.MONGODB_COLLECTION?.trim() || "highscores");
      await collection.createIndex({ score: -1, createdAt: 1 });
      return collection;
    })();

    collectionPromise = nextCollectionPromise.catch((error: unknown) => {
      // A paused Atlas cluster can fail while this serverless instance stays warm.
      // Clear the cached promises so a later request can reconnect after resume.
      collectionPromise = undefined;
      globalForMongo.cosmogramMongoClient = undefined;
      throw error;
    });
  }

  return collectionPromise;
}

async function getTopScores(collection: Collection<ScoreDocument>): Promise<Array<{ name: string; score: number; createdAt: string }>> {
  const scores = await collection
    .find({}, { projection: { _id: 0, name: 1, score: 1, createdAt: 1 } })
    .sort({ score: -1, createdAt: 1 })
    .limit(LEADERBOARD_LIMIT)
    .toArray();

  return scores.map((entry) => ({
    name: entry.name,
    score: entry.score,
    createdAt: entry.createdAt.toISOString(),
  }));
}

function parseBody(value: unknown): HighscoreBody | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as HighscoreBody;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as HighscoreBody) : null;
  } catch {
    return null;
  }
}

function validateName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = Array.from(normalized).slice(0, MAX_NAME_LENGTH).join("");

  return name.length > 0 && name.length <= MAX_NAME_LENGTH && name === normalized ? name : null;
}

function validateScore(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SCORE ? value : null;
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN?.trim() || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}
