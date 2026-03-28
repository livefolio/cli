import { Command } from 'commander'
import { loadTokens } from '../../auth/store.js'

export const statusCommand = new Command('status')
  .description('Show current authentication status')
  .action(async () => {
    const tokens = await loadTokens()

    if (!tokens) {
      process.stdout.write('Not logged in.\n')
      return
    }

    const now = Math.floor(Date.now() / 1000)
    const isExpired = tokens.expiresAt <= now

    if (tokens.userEmail) {
      process.stdout.write(`Logged in as: ${tokens.userEmail}\n`)
    } else {
      process.stdout.write('Logged in\n')
    }

    process.stdout.write(`Supabase URL: ${tokens.supabaseUrl}\n`)

    if (isExpired) {
      process.stdout.write('Token status: expired\n')
    } else {
      const expiresIn = tokens.expiresAt - now
      const minutes = Math.floor(expiresIn / 60)
      process.stdout.write(`Token status: valid (expires in ${minutes}m)\n`)
    }
  })
