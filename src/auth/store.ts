import { readFile, writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp
  userEmail?: string
  supabaseUrl: string
  clientId: string
}

const CONFIG_DIR = join(homedir(), '.config', 'livefolio')
const TOKEN_FILE = join(CONFIG_DIR, 'auth.json')

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, 'utf-8')
    return JSON.parse(data) as StoredTokens
  } catch {
    return null
  }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 })
}

export async function clearTokens(): Promise<void> {
  try { await rm(TOKEN_FILE) } catch { /* ignore */ }
}
