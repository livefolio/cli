# `auth`

Manage authentication for the CLI. All other commands require an active session — use `auth login` to authenticate before running market, portfolio, or strategy commands.

## Log in to your Livefolio account

Starts the authentication flow by printing an OAuth URL and opening it in your default browser. Complete the prompt in the browser to grant the CLI access to your account. Once approved, a session token is stored locally and reused for subsequent commands.

```shell
livefolio auth login
```

**Returns**

```
https://www.livefol.io/oauth/...
```

## See your authentication status

Prints your current authentication state as JSON when logged in. Produces no output if there is no active session.

```shell
livefolio auth status
```

**Returns**

```json
{
  "email": "you@example.com",
  "expiresAt": "2025-06-15T12:00:00Z"
}
```

## Log out of your account

Ends the current session and removes locally stored credentials. Produces no output on success.

```shell
livefolio auth logout
```
