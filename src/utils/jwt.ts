/** Whether a JWT `aud` claim targets Convex. */
export function audIncludesConvex(aud: unknown): boolean {
  if (aud === 'convex') return true;
  if (Array.isArray(aud)) return aud.some((v) => v === 'convex');
  return false;
}

export function sessionClaimsHaveConvexAud(claims: Record<string, unknown> | null | undefined): boolean {
  return audIncludesConvex(claims?.aud);
}

/** Decode JWT payload (no signature verification — used only to pick token source). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function tokenHasConvexAud(token: string): boolean {
  return sessionClaimsHaveConvexAud(decodeJwtPayload(token));
}
