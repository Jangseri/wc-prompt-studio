/**
 * Authentication stub.
 *
 * Current policy (resolved during step-2 blockers): internal-network-only,
 * no auth layer, pursued on a separate PR track per
 * docs/unified-workspace-plan.md §7 and §6A.6.
 *
 * This stub is the insertion point for real auth middleware. API routes call
 * `requireSession(request)` so the contract can be hardened later without
 * touching route code.
 */

export interface Session {
  userId: string | null;
  anonymous: boolean;
}

const ANONYMOUS_SESSION: Session = Object.freeze({
  userId: null,
  anonymous: true,
});

export async function requireSession(_request: Request): Promise<Session> {
  // TODO(auth): replace with real session check (cookie / header / JWT) once
  // the auth track lands.
  return ANONYMOUS_SESSION;
}
