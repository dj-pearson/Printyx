/**
 * express-session Type Augmentations
 *
 * Many Express route handlers read authenticated context from
 * `req.session.user` (e.g. `req.session.user.tenantId`, `req.session.user.id`).
 * The base `SessionData` from `@types/express-session` does not declare this
 * property, so those reads previously produced ~500 TS2339 errors
 * ("Property 'user' does not exist on type 'Session & Partial<SessionData>'").
 *
 * This declaration merges a typed, fully-optional `user` bag onto SessionData
 * covering every field the route layer reads. It is additive and type-only —
 * no runtime behavior changes.
 *
 * KNOWN LATENT BUG (tracked separately, see QUALITY-002 notes): nothing in the
 * auth/login flow currently assigns `req.session.user`; session login sets the
 * flat `req.session.userId` / `req.session.tenantId` fields instead. Routes that
 * gate solely on `req.session.user?.tenantId` therefore always 401 at runtime.
 * Populating `req.session.user` (or migrating those routes to the
 * `getUserId` / `getTenantId` auth-helpers) is a follow-up that touches the
 * security-sensitive login path and is intentionally out of scope for the
 * typecheck-burndown batch.
 */
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      // When a session user is present, these auth-critical fields are always
      // set together — declaring them required lets `if (!user)` guards narrow
      // them to `string` for the many downstream storage calls that need it.
      id: string;
      tenantId: string;
      role?: string;
      roleLevel?: number;
      role_level?: number;
      email?: string;
      firstName?: string;
      fullName?: string;
      twoFactorEnabled?: boolean;
      twoFactorSecret?: string;
    };
  }
}
