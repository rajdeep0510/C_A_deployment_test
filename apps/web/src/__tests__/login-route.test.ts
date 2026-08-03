import { POST } from "@/app/api/auth/login/route";

jest.mock("@/lib/auth", () => ({
  verifyPassword: jest.fn(),
  createSession: jest.fn().mockResolvedValue({ rawToken: "tok", session: {} }),
  setSessionCookie: jest.fn((res: any) => res),
  resolvePostLoginRedirect: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    app_users: {
      findFirst: jest.fn(),
    },
    players: {
      findFirst: jest.fn(),
    },
    user_sessions: {
      create: jest.fn(),
    },
  },
}));

import { verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const verifyPasswordMock = verifyPassword as jest.Mock;
const prismaMock = prisma as any;

const uid = () => `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function makeRequest(id: string, password: string, ip = "203.0.113.7"): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ id, password }),
  });
}

// Note: the route uses a shared module-level rate limiter, so every test uses a
// unique ID/IP and never exceeds the per-ID (5) or per-IP (20) caps unless the
// test is explicitly exercising the limiter.

describe("login route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.app_users.findFirst.mockResolvedValue(null);
    prismaMock.players.findFirst.mockResolvedValue(null);
  });

  describe("anti-enumeration (Candidates 1 & 2)", () => {
    it("returns a generic 401 and never passes null/undefined to bcrypt when the user does not exist", async () => {
      verifyPasswordMock.mockResolvedValue(false);

      const res = await POST(makeRequest(`nouser-${uid()}`, "whatever"));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid ID or password");

      // The dummy hash passed to bcrypt must be a real $2b$12$ hash (60 chars),
      // not null and not the old invalid placeholder string.
      const hashArg = verifyPasswordMock.mock.calls[0][1];
      expect(typeof hashArg).toBe("string");
      expect(hashArg).toMatch(/^\$2b\$12\$/);
      expect(hashArg.length).toBe(60);
    });

    it("returns the identical 401 body for a non-existent user and a wrong password", async () => {
      prismaMock.app_users.findFirst.mockResolvedValue({
        id: "u1",
        password_hash: "$2b$12$abcdefghijklmnopqrstuu7D.Pr8eXxS0HfOGlwJ9r9Xq0cVAp0AO",
        profile: null,
        player: null,
      });
      verifyPasswordMock.mockResolvedValue(false);

      const wrongPwRes = await POST(makeRequest(`user-${uid()}`, "wrongpass"));
      const noUserRes = await POST(makeRequest(`nouser-${uid()}`, "whatever"));

      expect(wrongPwRes.status).toBe(401);
      expect(noUserRes.status).toBe(401);
      expect(await wrongPwRes.json()).toEqual(await noUserRes.json());
    });

    it("uses a real bcrypt hash for migrated accounts so timing stays constant", async () => {
      prismaMock.app_users.findFirst.mockResolvedValue({
        id: "u1",
        password_hash: "[MIGRATED]",
        profile: null,
        player: null,
      });
      verifyPasswordMock.mockResolvedValue(false);

      const res = await POST(makeRequest(`migrated-${uid()}`, "whatever"));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("PASSWORD_RESET_REQUIRED");

      const hashArg = verifyPasswordMock.mock.calls[0][1];
      expect(typeof hashArg).toBe("string");
      expect(hashArg.length).toBe(60);
    });
  });

  describe("account-state handling", () => {
    it("returns PASSWORD_SETUP_REQUIRED with the raw id for placeholder hashes", async () => {
      prismaMock.app_users.findFirst.mockResolvedValue({
        id: "u1",
        password_hash: "*pending-setup",
        profile: null,
        player: null,
      });
      verifyPasswordMock.mockResolvedValue(false);

      const res = await POST(makeRequest("legacy@example.com", "x"));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("PASSWORD_SETUP_REQUIRED");
      expect(data.id).toBe("legacy@example.com");
    });

    it("returns EMAIL_NOT_VERIFIED for staff with a valid password but unverified email", async () => {
      prismaMock.app_users.findFirst.mockResolvedValue({
        id: "u1",
        password_hash: "$2b$12$abcdefghijklmnopqrstuu7D.Pr8eXxS0HfOGlwJ9r9Xq0cVAp0AO",
        email_verified: false,
        profile: { role: "coach" },
        player: null,
      });
      verifyPasswordMock.mockResolvedValue(true);

      const res = await POST(makeRequest(`coach-${uid()}@example.com`, "correct-password"));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("EMAIL_NOT_VERIFIED");
    });

    it("does NOT block players on unverified email (verification applies to staff only)", async () => {
      prismaMock.app_users.findFirst.mockResolvedValue({
        id: "u1",
        password_hash: "$2b$12$abcdefghijklmnopqrstuu7D.Pr8eXxS0HfOGlwJ9r9Xq0cVAp0AO",
        email_verified: false,
        profile: null,
        player: { status: "approved" },
      });
      verifyPasswordMock.mockResolvedValue(true);

      const res = await POST(makeRequest(`player-${uid()}`, "correct-password"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.redirectTo).toBe("/dashboard");
    });
  });

  describe("rate limiting (Candidate 4)", () => {
    it("returns a generic 429 after 5 attempts for the same ID", async () => {
      const id = `ratelimit-${uid()}`;
      verifyPasswordMock.mockResolvedValue(false);

      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await POST(makeRequest(id, "x", "203.0.113.44"));
        results.push(res.status);
      }

      expect(results.slice(0, 5).every((s) => s === 401)).toBe(true);
      expect(results[5]).toBe(429);
    });

    it("returns a generic 429 after 20 attempts from the same IP across different IDs", async () => {
      const ip = "203.0.113.45";
      verifyPasswordMock.mockResolvedValue(false);

      const results: number[] = [];
      for (let i = 0; i < 21; i++) {
        const res = await POST(makeRequest(`ip-${uid()}`, "x", ip));
        results.push(res.status);
      }

      expect(results[20]).toBe(429);
    });
  });
});
