import { runStrategyAction } from "../strategy/contract.js";
import { normalizeBaseUrl, readStoredAuthSession, resolveBaseUrl } from "../../auth/session.js";

export async function statusAction(options: { baseUrl?: string }): Promise<void> {
  await runStrategyAction(async () => {
    const session = await readStoredAuthSession();
    const requestedBaseUrl = options.baseUrl ? resolveBaseUrl(options.baseUrl) : null;
    const matchesBaseUrl = session && requestedBaseUrl
      ? normalizeBaseUrl(session.baseUrl) === requestedBaseUrl
      : null;

    return {
      authenticated: Boolean(session) && (requestedBaseUrl == null || matchesBaseUrl === true),
      ...(session
        ? {
            session: {
              baseUrl: session.baseUrl,
              clientId: session.clientId,
              scope: session.scope,
              expiresAt: session.expiresAt,
            },
          }
        : {}),
      ...(requestedBaseUrl ? { requestedBaseUrl, matchesBaseUrl } : {}),
    };
  });
}
