import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLoadSession = vi.fn();
const mockIsExpired = vi.fn();

vi.mock("../../lib/session.js", () => ({
  loadSession: () => mockLoadSession(),
  isExpired: (...args: unknown[]) => mockIsExpired(...args),
}));

import { statusAction } from "./status.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake JWT with the given payload (header & signature are ignored). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

// ---------------------------------------------------------------------------
// Capture stdout
// ---------------------------------------------------------------------------

let stdout: string;

beforeEach(() => {
  stdout = "";
  vi.spyOn(console, "log").mockImplementation((msg: string) => {
    stdout += msg + "\n";
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("statusAction", () => {
  it('prints "Not logged in" when no session exists', async () => {
    mockLoadSession.mockReturnValue(null);

    await statusAction();

    expect(stdout).toContain("Not logged in");
  });

  it("prints expired message when session is expired", async () => {
    mockLoadSession.mockReturnValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 1000,
    });
    mockIsExpired.mockReturnValue(true);

    await statusAction();

    expect(stdout).toContain("Session expired");
  });

  it("prints logged in with email when JWT contains email claim", async () => {
    mockLoadSession.mockReturnValue({
      accessToken: fakeJwt({ email: "user@example.com", sub: "abc-123" }),
      refreshToken: "rt",
      expiresAt: 1742000000000,
    });
    mockIsExpired.mockReturnValue(false);

    await statusAction();

    expect(stdout).toContain("Logged in as user@example.com");
    expect(stdout).toContain("2025-03-15");
  });

  it("falls back to message without email when JWT has no email", async () => {
    mockLoadSession.mockReturnValue({
      accessToken: fakeJwt({ sub: "abc-123" }),
      refreshToken: "rt",
      expiresAt: 1742000000000,
    });
    mockIsExpired.mockReturnValue(false);

    await statusAction();

    expect(stdout).toContain("Logged in");
    expect(stdout).not.toContain("Logged in as");
    expect(stdout).toContain("2025-03-15");
  });
});
