/**
 * Auth Core Routes
 *
 * Consolidates all authentication and session-related routes:
 * - Login / logout / signup
 * - Password reset (forgot, verify-reset-token, reset)
 * - Email verification (verify-email, resend-verification)
 * - Current user (/api/me, /api/auth/user)
 *
 * Auth sub-routes under /api/auth/* are handled by auth-routes.ts (login, logout,
 * signup, password reset, email verification, session user).
 */

import type { Express } from 'express';
import { authRoutes } from './auth-routes';
import { storage } from './storage';
import { getUserId } from './utils/auth-helpers';

export function registerAuthCoreRoutes(app: Express) {
  // Mount all /api/auth/* routes (login, logout, signup, password reset, email verification, user)
  app.use('/api/auth', authRoutes);

  // Current user endpoint (Supabase JWT / session-aware)
  // Intended for the frontend to hydrate profile/role/team from the server DB
  // to avoid relying on PostgREST access to internal tables (which may be RLS-protected).
  app.get('/api/me', async (req: any, res, next) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUserWithRole(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        roleId: user.roleId,
        teamId: user.teamId,
        accessScope: (user as any).accessScope || undefined,
        isPlatformUser: (user as any).isPlatformUser || (user as any).is_platform_user || false,
        role: (user as any).role || undefined,
        team: (user as any).team || undefined,
      });
    } catch (error) {
      next(error);
    }
  });
}
