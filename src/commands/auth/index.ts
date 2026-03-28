import type { Command } from 'commander'
import { loginCommand } from './login.js'
import { logoutCommand } from './logout.js'
import { statusCommand } from './status.js'

export function registerAuth(program: Command): void {
  const auth = program
    .command('auth')
    .description('Authentication commands')

  auth.addCommand(loginCommand)
  auth.addCommand(logoutCommand)
  auth.addCommand(statusCommand)
}
