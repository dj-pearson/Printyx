import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to block new user registrations
 * Use this to prevent new signups while the app is in pre-launch mode
 */
export function blockRegistrations(req: Request, res: Response, next: NextFunction) {
  // Block any routes that might be used for user registration
  const blockedPaths = [
    '/api/auth/register',
    '/api/auth/signup', 
    '/api/users/register',
    '/api/register',
    '/api/signup'
  ];
  
  if (blockedPaths.includes(req.path)) {
    return res.status(503).json({ 
      message: "New user registration is temporarily disabled. We're launching October 1st, 2025!",
      launchDate: "2025-10-01"
    });
  }
  
  next();
}