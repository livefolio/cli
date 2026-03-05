import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock-home",
}));

import {
  loadSession,
  saveSession,
  clearSession,
  isExpired,
  SESSION_DIR,
  SESSION_PATH,
} from "./session.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

describe("session paths", () => {
  it("SESSION_DIR points to ~/.livefolio", () => {
    expect(SESSION_DIR).toBe("/mock-home/.livefolio");
  });

  it("SESSION_PATH points to ~/.livefolio/session.json", () => {
    expect(SESSION_PATH).toBe("/mock-home/.livefolio/session.json");
  });
});

// ---------------------------------------------------------------------------
// loadSession
// ---------------------------------------------------------------------------

describe("loadSession", () => {
  it("returns parsed session when file is valid", () => {
    const stored = { accessToken: "at", refreshToken: "rt", expiresAt: 9999999999999 };
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    expect(loadSession()).toEqual(stored);
  });

  it("returns null when file does not exist", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(loadSession()).toBeNull();
  });

  it("returns null when file contains invalid JSON", () => {
    mockReadFileSync.mockReturnValue("not json");

    expect(loadSession()).toBeNull();
  });

  it("returns null when file is missing required fields", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ accessToken: "at" }));

    expect(loadSession()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveSession
// ---------------------------------------------------------------------------

describe("saveSession", () => {
  it("creates directory and writes session file with correct expiry", () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    saveSession({ accessToken: "at", refreshToken: "rt", expiresIn: 3600 });

    expect(mockMkdirSync).toHaveBeenCalledWith(SESSION_DIR, { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      SESSION_PATH,
      JSON.stringify({ accessToken: "at", refreshToken: "rt", expiresAt: now + 3600000 }, null, 2),
      { mode: 0o600 },
    );
  });
});

// ---------------------------------------------------------------------------
// clearSession
// ---------------------------------------------------------------------------

describe("clearSession", () => {
  it("deletes session file", () => {
    clearSession();
    expect(mockUnlinkSync).toHaveBeenCalledWith(SESSION_PATH);
  });

  it("does not throw if file does not exist", () => {
    mockUnlinkSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(() => clearSession()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isExpired
// ---------------------------------------------------------------------------

describe("isExpired", () => {
  it("returns true when current time is past expiresAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    expect(isExpired({ accessToken: "at", refreshToken: "rt", expiresAt: 1000 })).toBe(true);
  });

  it("returns true when current time equals expiresAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    expect(isExpired({ accessToken: "at", refreshToken: "rt", expiresAt: 1000 })).toBe(true);
  });

  it("returns false when current time is before expiresAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(500);
    expect(isExpired({ accessToken: "at", refreshToken: "rt", expiresAt: 1000 })).toBe(false);
  });
});
