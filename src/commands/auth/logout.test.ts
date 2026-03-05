import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClearSession = vi.fn();

vi.mock("../../lib/session.js", () => ({
  clearSession: () => mockClearSession(),
}));

import { logoutAction } from "./logout.js";

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

describe("logoutAction", () => {
  it("clears session and prints confirmation", async () => {
    await logoutAction();

    expect(mockClearSession).toHaveBeenCalled();
    expect(stdout).toContain("Logged out");
  });
});
