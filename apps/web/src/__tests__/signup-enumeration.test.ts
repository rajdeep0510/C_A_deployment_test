import { POST } from "@/app/api/auth/signup/route";

jest.mock("@/lib/auth", () => ({
  registerStaffUser: jest.fn().mockRejectedValue(new Error("EMAIL_TAKEN")),
  registerPlayerUser: jest.fn().mockRejectedValue(new Error("EMAIL_TAKEN")),
}));

jest.mock("@/lib/email", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

// Note: the route's own per-IP/per-email limiter uses module-level state, so
// these tests intentionally exercise only the enumeration path with fresh
// email addresses. Rate-limit behavior itself is covered in rate-limit.test.ts.

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.99" },
    body: JSON.stringify(body),
  });
}

describe("signup anti-enumeration", () => {
  it("returns a generic 201 (not 409) when the email is already registered (player)", async () => {
    const res = await POST(
      makeRequest({
        type: "player",
        email: `existing-${Date.now()}@example.com`,
        fullName: "Test Player",
        coachId: "coach_1",
        chessUsername: "newplayer",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.error).toBeUndefined();
    expect(data.message).toBeTruthy();
    expect(data.message).not.toMatch(/already registered/i);
  });

  it("returns a generic 201 (not 409) when the username is already taken (player)", async () => {
    const res = await POST(
      makeRequest({
        type: "player",
        email: `fresh-${Date.now()}@example.com`,
        fullName: "Test Player",
        coachId: "coach_1",
        chessUsername: "takenuser",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.error).toBeUndefined();
    expect(data.message).not.toMatch(/already registered/i);
  });

  it("returns a generic 201 for staff with an existing email (coach)", async () => {
    const res = await POST(
      makeRequest({
        type: "coach",
        email: `existing-staff-${Date.now()}@example.com`,
        fullName: "Test Coach",
        password: "password123",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.error).toBeUndefined();
    expect(data.message).toBeTruthy();
    expect(data.message).not.toMatch(/already registered/i);
  });

  it("still validates password length for staff registrations", async () => {
    const res = await POST(
      makeRequest({
        type: "coach",
        email: `shortpw-${Date.now()}@example.com`,
        fullName: "Test Coach",
        password: "short",
      })
    );
    expect(res.status).toBe(400);
  });

  it("allows player registrations without a password (they set it later)", async () => {
    const res = await POST(
      makeRequest({
        type: "player",
        email: `nopw-${Date.now()}@example.com`,
        fullName: "Test Player",
        coachId: "coach_1",
        chessUsername: "nopwplayer",
      })
    );
    // registerPlayerUser is mocked to reject with EMAIL_TAKEN, so the generic
    // 201 path is exercised; importantly it must NOT be a 400 for missing password.
    expect(res.status).toBe(201);
  });
});
