import { loadSession, isExpired } from "../../lib/session.js";

export async function statusAction(): Promise<void> {
  const session = loadSession();

  if (!session) {
    console.log("Not logged in");
    return;
  }

  if (isExpired(session)) {
    console.log("Session expired — run: livefolio auth login");
    return;
  }

  const expiresAt = new Date(session.expiresAt).toISOString();

  let email: string | undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(session.accessToken.split(".")[1], "base64url").toString(),
    );
    email = payload.email;
  } catch {
    // malformed token — fall through without email
  }

  if (email) {
    console.log(`Logged in as ${email} (session expires ${expiresAt})`);
  } else {
    console.log(`Logged in (session expires ${expiresAt})`);
  }
}
