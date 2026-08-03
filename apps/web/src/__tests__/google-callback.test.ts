import { GET } from "@/app/api/auth/google/callback/route";

jest.mock("@/lib/auth", () => ({
  createSession: jest.fn().mockResolvedValue({ rawToken: "tok", session: {} }),
  setSessionCookie: jest.fn((res: any) => res),
  resolvePostLoginRedirect: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/google-auth", () => ({
  exchangeCodeForProfile: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    app_users: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    profiles: {
      findUnique: jest.fn(),
    },
    players: {
      findUnique: jest.fn(),
    },
  },
}));

import { exchangeCodeForProfile } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";

const exchangeMock = exchangeCodeForProfile as jest.Mock;
const prismaMock = prisma as any;

function makeRequest(code = "code123", state = "state123"): Request {
  return new Request(`http://localhost/api/auth/google/callback?code=${code}&state=${state}`, {
    headers: { cookie: `google_oauth_state=${state}` },
  });
}

const PROFILE = (over: Partial<any> = {}) => ({
  sub: "google-sub-1",
  email: "user@example.com",
  emailVerified: true,
  name: null,
  picture: null,
  ...over,
});

// `findUnique` is called twice: first by google_sub, then by email_lower.
function mockFindUnique(bySub: any, byEmail: any) {
  prismaMock.app_users.findUnique.mockImplementation(({ where }: any) => {
    if (where.google_sub !== undefined) return Promise.resolve(bySub);
    if (where.email_lower !== undefined) return Promise.resolve(byEmail);
    return Promise.resolve(null);
  });
}

describe("google callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exchangeMock.mockResolvedValue(PROFILE());
    prismaMock.profiles.findUnique.mockResolvedValue(null);
    prismaMock.players.findUnique.mockResolvedValue({ status: "approved" });
  });

  describe("email verification bypass (Candidate 3)", () => {
    it("does NOT silently verify an existing unverified account when signing in via Google", async () => {
      mockFindUnique(null, { id: "u1", email_verified: false, password_hash: "$2b$12$abc" });

      const res = await GET(makeRequest());

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("google_error=email_not_verified");
      expect(prismaMock.app_users.update).not.toHaveBeenCalled();
      expect(prismaMock.app_users.create).not.toHaveBeenCalled();
    });

    it("links Google to an existing verified account without flipping email_verified", async () => {
      mockFindUnique(null, { id: "u1", email_verified: true });
      prismaMock.app_users.update.mockResolvedValue({ id: "u1", email_verified: true });

      const res = await GET(makeRequest());

      expect(prismaMock.app_users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: expect.objectContaining({ google_sub: "google-sub-1" }),
        })
      );
      // The update must not re-assert email_verified (it was already true).
      expect(prismaMock.app_users.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email_verified: true }) })
      );
      expect(res.status).toBe(307);
    });

    it("rejects creating a new account when Google has not verified the email", async () => {
      mockFindUnique(null, null);
      exchangeMock.mockResolvedValue(PROFILE({ emailVerified: false }));

      const res = await GET(makeRequest());

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("google_error=email_not_verified");
      expect(prismaMock.app_users.create).not.toHaveBeenCalled();
    });

    it("creates a verified account for a new Google user with a verified email", async () => {
      mockFindUnique(null, null);
      prismaMock.app_users.create.mockResolvedValue({ id: "new1", email_verified: true });

      const res = await GET(makeRequest());

      expect(prismaMock.app_users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "user@example.com", email_verified: true }),
        })
      );
      expect(res.status).toBe(307);
    });
  });

  describe("state cookie cleanup (Candidate 10)", () => {
    it("clears the google_oauth_state cookie on an invalid-state redirect", async () => {
      const res = await GET(
        new Request("http://localhost/api/auth/google/callback?code=c&state=wrong", {
          headers: { cookie: "google_oauth_state=other" },
        })
      );

      expect(res.status).toBe(307);
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("google_oauth_state");
      expect(setCookie).toContain("Max-Age=0");
    });

    it("clears the google_oauth_state cookie on the email-not-verified redirect", async () => {
      mockFindUnique(null, { id: "u1", email_verified: false, password_hash: "$2b$12$abc" });

      const res = await GET(makeRequest());

      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("google_oauth_state");
      expect(setCookie).toContain("Max-Age=0");
    });
  });
});
