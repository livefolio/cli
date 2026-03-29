import { Command } from 'commander'
import { clearTokens } from '../../auth/store.js'

export const logoutCommand = new Command('logout')
  .description('Log out and clear stored credentials')
  .action(async () => {
    await clearTokens()
    process.stdout.write('Logged out.\n')
  })
