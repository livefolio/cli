import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SESSION_DIR = join(homedir(), ".livefolio");
export const SESSION_PATH = join(SESSION_DIR, "session.json");

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export function loadSession(): StoredSession | null {
  try {
    const raw = readFileSync(SESSION_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (
      data &&
      typeof data.accessToken === "string" &&
      typeof data.refreshToken === "string" &&
      typeof data.expiresAt === "number"
    ) {
      return data as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  const stored: StoredSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  writeFileSync(SESSION_PATH, JSON.stringify(stored, null, 2), { mode: 0o600 });
}

export function clearSession(): void {
  try {
    unlinkSync(SESSION_PATH);
  } catch {
    // ignore if file doesn't exist
  }
}

export function isExpired(session: StoredSession): boolean {
  return Date.now() >= session.expiresAt;
}
