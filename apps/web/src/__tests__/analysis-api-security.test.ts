import { NextResponse } from "next/server";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as batchPOST } from "@/app/api/batch/route";
import { MAX_BATCH_GAME_URLS, MAX_INFLIGHT_JOBS_PER_USER } from "@/lib/analysis-security";

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    analysis_jobs: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    batch_jobs: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requireAuthMock = requireAuth as jest.Mock;
const prismaMock = prisma as any;

function makeRequest(
  body: unknown,
  opts: { ip?: string; cookie?: string } = {}
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  if (opts.cookie) headers["cookie"] = opts.cookie;
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// `requireAuth` returns a 401 NextResponse when there is no session, and the
// session object (with app_user) when authenticated.
const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const SESSION = { app_user: { id: "user_123" } } as any;

describe("analysis API security (R4/R15)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(SESSION);
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated POST /api/analyze", async () => {
      requireAuthMock.mockResolvedValue(UNAUTHORIZED);
      const res = await analyzePOST(
        makeRequest({ username: "x", filename: "y" }, { ip: "198.51.100.1" })
      );
      expect(res.status).toBe(401);
    });

    it("returns 401 for unauthenticated POST /api/batch", async () => {
      requireAuthMock.mockResolvedValue(UNAUTHORIZED);
      const res = await batchPOST(
        makeRequest(
          { username: "x", game_urls: ["https://www.chess.com/game/live/1"] },
          { ip: "198.51.100.2" }
        )
      );
      expect(res.status).toBe(401);
    });
  });

  describe("batch size caps and URL validation", () => {
    it("rejects POST /api/batch with more than the max game_urls", async () => {
      const tooMany = Array.from(
        { length: MAX_BATCH_GAME_URLS + 1 },
        (_, i) => `https://lichess.org/${i}`
      );
      const res = await batchPOST(
        makeRequest({ username: "x", game_urls: tooMany }, { ip: "198.51.100.3" })
      );
      expect(res.status).toBe(400);
    });

    it("rejects POST /api/batch with non-platform URLs", async () => {
      const res = await batchPOST(
        makeRequest(
          { username: "x", game_urls: ["https://evil.example.com/steal"] },
          { ip: "198.51.100.4" }
        )
      );
      expect(res.status).toBe(400);
    });

    it("accepts valid Chess.com and Lichess URLs", async () => {
      prismaMock.batch_jobs.findFirst.mockResolvedValue(null);
      prismaMock.batch_jobs.create.mockResolvedValue({ id: "job_1" });
      const res = await batchPOST(
        makeRequest(
          {
            username: "x",
            game_urls: [
              "https://www.chess.com/game/live/12345",
              "https://lichess.org/abcdef",
            ],
          },
          { ip: "198.51.100.5" }
        )
      );
      expect(res.status).toBe(200);
      expect(prismaMock.batch_jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ game_urls: expect.any(Array) }),
        })
      );
    });
  });

  describe("job quota", () => {
    it("returns 429 when the user already has the max in-flight jobs", async () => {
      prismaMock.analysis_jobs.count.mockResolvedValue(MAX_INFLIGHT_JOBS_PER_USER);
      const res = await analyzePOST(
        makeRequest({ username: "busy", filename: "game.pgn" }, { ip: "198.51.100.6" })
      );
      expect(res.status).toBe(429);
      expect(prismaMock.analysis_jobs.create).not.toHaveBeenCalled();
    });

    it("creates a job when under the quota", async () => {
      prismaMock.analysis_jobs.count.mockResolvedValue(0);
      prismaMock.analysis_jobs.findFirst.mockResolvedValue(null);
      prismaMock.analysis_jobs.create.mockResolvedValue({ id: "job_2" });
      const res = await analyzePOST(
        makeRequest({ username: "light", filename: "game.pgn" }, { ip: "198.51.100.7" })
      );
      expect(res.status).toBe(200);
      expect(prismaMock.analysis_jobs.create).toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("returns 429 after exceeding the per-IP limit for job creation", async () => {
      requireAuthMock.mockImplementation(async () => SESSION);
      // The route under test shares the in-memory limiter with the app; use a
      // unique IP and a small scope so we can hit the limit deterministically.
      const ip = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
      const results: number[] = [];
      for (let i = 0; i < 31; i++) {
        prismaMock.analysis_jobs.count.mockResolvedValue(0);
        prismaMock.analysis_jobs.findFirst.mockResolvedValue(null);
        prismaMock.analysis_jobs.create.mockResolvedValue({ id: `j_${i}` });
        const res = await analyzePOST(
          makeRequest({ username: "rl", filename: `g${i}.pgn` }, { ip })
        );
        results.push(res.status);
      }
      expect(results.slice(0, 30).every((s) => s === 200)).toBe(true);
      expect(results[30]).toBe(429);
    });
  });
});
