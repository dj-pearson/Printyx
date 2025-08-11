import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use memory store for now to avoid session configuration issues
  return session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Use existing demo tenant for all authenticated users
  const defaultTenantId = process.env.DEMO_TENANT_ID || "550e8400-e29b-41d4-a716-446655440000";
  
  // Ensure tenant exists
  let tenant = await storage.getTenant(defaultTenantId);
  if (!tenant) {
    try {
      tenant = await storage.createTenant({
        name: "Default Copier Dealer",
        domain: "default",
      });
    } catch (error: any) {
      if (error.code === '23505') {
        // Tenant already exists, just use the hardcoded ID
        tenant = { id: defaultTenantId } as any;
      } else {
        throw error;
      }
    }
  }

  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    tenantId: tenant?.id || defaultTenantId,
    role: "admin", // Give all users admin role for demo
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated || !req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Add tenant context to user if missing - FIXED APPROACH
  if (!user.tenantId) {
    console.log("User missing tenantId, user object:", JSON.stringify({
      hasClaimsSub: !!user.claims?.sub,
      claims: user.claims,
      keys: Object.keys(user)
    }, null, 2));
    
    // Try to get from database or use default tenant for demo
    if (user.claims?.sub) {
      try {
        const dbUser = await storage.getUser(user.claims.sub);
        if (dbUser && dbUser.tenantId) {
          user.tenantId = dbUser.tenantId;
          console.log("Set tenantId from DB user:", user.tenantId);
        } else {
          user.tenantId = "550e8400-e29b-41d4-a716-446655440000";
          console.log("DB user not found, using default tenantId");
        }
      } catch (error) {
        console.error("Error fetching user from DB:", error);
        user.tenantId = "550e8400-e29b-41d4-a716-446655440000";
        console.log("Error fallback - using default tenantId");
      }
    } else {
      user.tenantId = "550e8400-e29b-41d4-a716-446655440000";
      console.log("No user claims.sub, using default tenantId");
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
