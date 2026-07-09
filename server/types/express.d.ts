/**
 * Express Type Augmentations
 *
 * Extends Express types to include custom properties used throughout the application.
 */

declare global {
  namespace Express {
    /**
     * Augmented User interface for authentication
     * This extends the base Express.User type used by Passport
     */
    interface User {
      id: string;
      email?: string;
      tenantId?: string;
      userId?: string;
      roleId?: string;
      roleLevel?: number;
      teamId?: string;
      accessScope?: string;
      isPlatformUser?: boolean;
      firstName?: string;
      lastName?: string;
      customerId?: string;
      customerPortalUser?: boolean;
      /**
       * OIDC/session claims populated by the session and test-mode auth paths
       * for backward compatibility with routes that read `req.user.claims.sub`.
       */
      claims?: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        [key: string]: unknown;
      };
      expires_at?: number;
    }

    /**
     * Augmented Request: customer-portal routes attach the validated portal
     * session (a CustomerPortalAccess row) here in requireCustomerPortalAuth.
     */
    interface Request {
      customerPortalUser?: {
        id?: string;
        customerId?: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
