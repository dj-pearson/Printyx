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
    }
  }
}

export {};
