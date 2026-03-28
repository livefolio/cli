import { Command } from 'commander'
import http from 'http'
import { exec } from 'child_process'
import { saveTokens } from '../../auth/store.js'
import { getLivefolio, getSupabaseUrl } from '../../config.js'

export const loginCommand = new Command('login')
  .description('Authenticate with Livefolio via browser')
  .action(async () => {
    const supabaseUrl = getSupabaseUrl()
    const livefolio = getLivefolio()
    const clientId = process.env.LIVEFOLIO_OAUTH_CLIENT_ID ?? ''

    if (!clientId) {
      process.stderr.write('Error: LIVEFOLIO_OAUTH_CLIENT_ID is required\n')
      process.exitCode = 1
      return
    }

    // Start local server for callback
    const server = http.createServer()
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as { port: number }).port)
      })
    })

    const redirectUri = `http://127.0.0.1:${port}/callback`
    const state = crypto.randomUUID()

    // Build authorization URL (generates PKCE internally)
    const { url, pkce } = livefolio.auth.buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    })

    process.stdout.write('Opening browser for authentication...\n')
    process.stdout.write(`If the browser doesn't open, visit: ${url}\n`)

    // Open browser (macOS; falls back silently on other platforms)
    exec(`open "${url}"`)

    // Wait for OAuth callback
    const result = await new Promise<{ code: string; state: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close()
        reject(new Error('Authentication timed out (120s)'))
      }, 120_000)

      server.on('request', (req, res) => {
        const reqUrl = new URL(req.url!, `http://127.0.0.1:${port}`)
        if (reqUrl.pathname !== '/callback') return

        const code = reqUrl.searchParams.get('code')
        const returnedState = reqUrl.searchParams.get('state')
        const error = reqUrl.searchParams.get('error')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication failed</h1><p>You can close this tab.</p>')
          clearTimeout(timeout)
          server.close()
          reject(new Error(`OAuth error: ${error}`))
          return
        }

        if (code && returnedState) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication successful!</h1><p>You can close this tab.</p>')
          clearTimeout(timeout)
          server.close()
          resolve({ code, state: returnedState })
        }
      })
    })

    // Validate state to prevent CSRF
    if (result.state !== state) {
      process.stderr.write('Error: OAuth state mismatch — possible CSRF attack\n')
      process.exitCode = 1
      return
    }

    // Exchange code for tokens
    const tokens = await livefolio.auth.exchangeCodeForTokens(
      result.code,
      pkce.codeVerifier,
      clientId,
      redirectUri,
    )

    // Save tokens to disk
    await saveTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expiresIn,
      supabaseUrl,
      clientId,
    })

    process.stdout.write('Authenticated successfully.\n')
  })
