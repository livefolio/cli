# Authenticate to use the CLI

All CLI commands require an authenticated session. Livefolio uses passwordless email authentication powered by Supabase Auth — no passwords are stored or transmitted. You must create an account on the Livefolio website before you can use the CLI.

## Create an account on our website

1. Go to [livefol.io](https://livefol.io) and enter your email address.
2. Check your inbox for a one-time verification code.
3. Enter the code on the website to complete your registration.

Once your account is created, you can authenticate the CLI using the steps below.

## Log in to your account

```shell
livefolio auth login
```

This command prints an authentication URL to your terminal and opens it in your default browser. Complete the authentication prompt in the browser to grant the CLI access to your account. Once approved, a session token is stored locally and reused for all subsequent commands until it expires or you log out.

## See your status

```shell
livefolio auth status
```

Prints your current authentication state. If you are logged in, it displays your email address and when the session expires. If there is no active session, it indicates that you are not authenticated.

## Log out

```shell
livefolio auth logout
```

Ends the current session and removes your locally stored credentials. After logging out, you will need to run `livefolio auth login` again before you can use any other CLI commands.