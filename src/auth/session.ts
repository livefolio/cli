import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface StoredAuthSession {
  baseUrl: string;
  clientId: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveBaseUrl(value?: string): string {
  if (value?.trim()) return normalizeBaseUrl(value.trim());
  if (process.env.LIVEFOLIO_BASE_URL?.trim()) {
    return normalizeBaseUrl(process.env.LIVEFOLIO_BASE_URL.trim());
  }
  return "http://localhost:3000";
}

export function authSessionFilePath(): string {
  return resolve(join(homedir(), ".livefolio", "auth.json"));
}

export async function readStoredAuthSession(): Promise<StoredAuthSession | null> {
  try {
    const raw = await readFile(authSessionFilePath(), "utf8");
    return JSON.parse(raw) as StoredAuthSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeStoredAuthSession(session: StoredAuthSession): Promise<void> {
  const filePath = authSessionFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function clearStoredAuthSession(): Promise<void> {
  await rm(authSessionFilePath(), { force: true });
}
