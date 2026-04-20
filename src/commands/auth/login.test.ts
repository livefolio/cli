import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBuildAuthorizationUrl = vi.fn();
const mockExchangeCodeForTokens = vi.fn();

vi.mock("@livefolio/sdk/auth", () => ({
  buildAuthorizationUrl: (...args: unknown[]) => mockBuildAuthorizationUrl(...args),
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
}));

vi.mock("../../config.js", () => ({
  getSupabaseUrl: () => "https://test.supabase.co",
  getOAuthClientId: () => "livefolio-cli",
}));

const mockSaveSession = vi.fn();
vi.mock("../../lib/session.js", () => ({
  saveSession: (...args: unknown[]) => mockSaveSession(...args),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, cb: (err: Error | null) => void) => cb(null)),
}));

const mockServerClose = vi.fn();
const mockServerListen = vi.fn();
let capturedHandler: (req: IncomingMessage, res: ServerResponse) => void;

vi.mock("node:http", () => ({
  createServer: vi.fn(
    (handler: (req: IncomingMessage, res: ServerResponse) => void) => {
      capturedHandler = handler;
      return { listen: mockServerListen, close: mockServerClose };
    },
  ),
}));

import { loginAction } from "./login.js";

// ---------------------------------------------------------------------------
// Capture stdout / stderr
// ---------------------------------------------------------------------------

let stdout: string;
let stderr: string;
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(console, "log").mockImplementation((msg: string) => {
    stdout += msg + "\n";
  });
  vi.spyOn(process.stderr, "write").mockImplementation((msg: string) => {
    stderr += msg;
    return true;
  });

  mockBuildAuthorizationUrl.mockReturnValue({
    url: "https://test.supabase.co/auth/v1/oauth/authorize?test=1",
    pkce: { codeVerifier: "test-verifier", codeChallenge: "test-challenge" },
  });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loginAction", () => {
  it("starts server, opens browser, exchanges code, and saves session", async () => {
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      tokenType: "bearer",
      scope: "openid",
    });

    mockServerListen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      const req = { url: "/callback?code=test-code" } as IncomingMessage;
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;
      capturedHandler(req, res);
    });

    await loginAction();

    expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
      "https://test.supabase.co",
      {
        clientId: "livefolio-cli",
        redirectUri: "http://localhost:12345/callback",
      },
    );
    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-code",
      "test-verifier",
      "livefolio-cli",
      "http://localhost:12345/callback",
    );
    expect(mockSaveSession).toHaveBeenCalled();
    expect(stdout).toContain("Logged in successfully");
    expect(stderr).toContain(
      "https://test.supabase.co/auth/v1/oauth/authorize?test=1",
    );
  });

  it("handles token exchange failure", async () => {
    mockExchangeCodeForTokens.mockRejectedValue(new Error("exchange failed"));

    mockServerListen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      const req = { url: "/callback?code=test-code" } as IncomingMessage;
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;
      capturedHandler(req, res);
    });

    await loginAction();

    expect(stderr).toContain("Error: exchange failed");
    expect(process.exitCode).toBe(1);
  });

  it("responds with 404 for non-callback paths", async () => {
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      tokenType: "bearer",
      scope: "openid",
    });

    const resNonCallback = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    mockServerListen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      capturedHandler({ url: "/other" } as IncomingMessage, resNonCallback);
      const req = { url: "/callback?code=test-code" } as IncomingMessage;
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;
      capturedHandler(req, res);
    });

    await loginAction();

    expect(resNonCallback.writeHead).toHaveBeenCalledWith(404);
  });

  it("responds with 400 when code is missing from callback", async () => {
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      tokenType: "bearer",
      scope: "openid",
    });

    const resMissingCode = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    mockServerListen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      capturedHandler({ url: "/callback" } as IncomingMessage, resMissingCode);
      const req = { url: "/callback?code=test-code" } as IncomingMessage;
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;
      capturedHandler(req, res);
    });

    await loginAction();

    expect(resMissingCode.writeHead).toHaveBeenCalledWith(400);
  });

  it("coerces non-Error thrown values to string", async () => {
    mockExchangeCodeForTokens.mockRejectedValue(42);

    mockServerListen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      const req = { url: "/callback?code=test-code" } as IncomingMessage;
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;
      capturedHandler(req, res);
    });

    await loginAction();

    expect(stderr).toContain("Error: 42");
    expect(process.exitCode).toBe(1);
  });
});
