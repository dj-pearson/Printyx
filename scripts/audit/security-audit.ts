/**
 * Security Audit Script
 *
 * Scans the codebase for common security issues including:
 * - CORS configuration
 * - Authentication middleware usage
 * - Input validation
 * - Rate limiting
 * - Sensitive data exposure
 * - SQL injection patterns
 * - XSS vulnerabilities
 *
 * Run with: npm run audit:security
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { generateReport, createIssue } from './lib/report-generator';
import type { SecurityTestResult, AuditReport, AuditIssue } from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const SERVER_DIR = path.join(process.cwd(), 'server');
const CLIENT_DIR = path.join(process.cwd(), 'client');
const ROOT_DIR = process.cwd();

// Files to exclude from scanning
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'audit-reports',
];

// ============================================================================
// Security Checks
// ============================================================================

interface SecurityCheck {
  name: string;
  category: SecurityTestResult['category'];
  severity: AuditIssue['severity'];
  check: (files: FileContent[]) => SecurityFinding[];
}

interface FileContent {
  path: string;
  content: string;
  lines: string[];
}

interface SecurityFinding {
  file: string;
  lineNumber?: number;
  message: string;
  codeSnippet?: string;
  suggestedFix?: string;
}

// ============================================================================
// File Scanner
// ============================================================================

function scanDirectory(dir: string, extensions: string[]): FileContent[] {
  const files: FileContent[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (EXCLUDE_PATTERNS.some((p) => fullPath.includes(p))) {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({
              path: fullPath,
              content,
              lines: content.split('\n'),
            });
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }
  }

  scan(dir);
  return files;
}

// ============================================================================
// Security Check Implementations
// ============================================================================

const securityChecks: SecurityCheck[] = [
  // 1. CORS Configuration
  {
    name: 'CORS Misconfiguration',
    category: 'cors',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for wildcard CORS origin
          if (
            line.includes("'*'") &&
            (line.includes('Access-Control-Allow-Origin') || line.includes('cors'))
          ) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Wildcard CORS origin (*) allows any domain to access the API',
              codeSnippet: line.trim(),
              suggestedFix: 'Use a specific list of allowed origins instead of wildcard',
            });
          }

          // Check for credentials with wildcard
          if (line.includes('credentials: true') && file.content.includes("origin: '*'")) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'CORS credentials enabled with wildcard origin is a security risk',
              codeSnippet: line.trim(),
              suggestedFix: 'Specify explicit origins when using credentials',
            });
          }
        }
      }

      return findings;
    },
  },

  // 2. Missing Authentication Middleware
  {
    name: 'Unprotected Routes',
    category: 'auth',
    severity: 'critical',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Route handler patterns
      const routePatterns = [
        /app\.(get|post|put|patch|delete)\s*\(\s*['"`]\/api\//,
        /router\.(get|post|put|patch|delete)\s*\(\s*['"`]\//,
      ];

      // Auth middleware patterns
      const authPatterns = [
        'requireAuth',
        'protectedRoute',
        'requireSupabaseAuth',
        'isAuthenticated',
        'authenticate',
        'authMiddleware',
        'platformAdminRoute',
      ];

      // Router-level middleware patterns (applied to all routes in file)
      const routerLevelAuthPatterns = [
        /router\.use\s*\(\s*platformAdminRoute\s*\)/,
        /router\.use\s*\(\s*requireAuth\s*\)/,
        /router\.use\s*\(\s*protectedRoute\s*\)/,
        /router\.use\s*\(\s*requireSupabaseAuth\s*\)/,
        /router\.use\s*\(\s*authMiddleware\s*\)/,
      ];

      // Public route patterns (safe to skip) - both absolute and relative paths
      // These routes are intentionally unauthenticated
      const publicPatterns = [
        // Health & status endpoints
        '/api/health',
        '/api/version',
        '/api/status',
        // Authentication endpoints (absolute paths)
        '/api/auth/login',
        '/api/auth/signup',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/auth/forgot',
        '/api/auth/reset',
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/verify-reset-token',
        '/api/auth/callback',
        '/api/auth/session',
        '/api/auth/user',
        '/api/auth/me',
        // Public content endpoints
        '/api/public',
        '/api/webhook',
        '/api/webhooks',
      ];

      // Relative paths for router-based auth routes
      const relativeAuthPatterns = [
        "'/login'",
        "'/signup'",
        "'/register'",
        "'/logout'",
        "'/forgot'",
        "'/forgot-password'",
        "'/reset'",
        "'/reset-password'",
        "'/verify-email'",
        "'/resend-verification'",
        "'/verify-reset-token'",
        "'/callback'",
        "'/session'",
        "'/user'",
        "'/me'",
      ];

      // Files that are known to be auth-related (their routes are intentionally public)
      const publicRouteFiles = ['auth-routes.ts', 'auth-routes.js'];

      for (const file of files) {
        // Only check route files
        if (!file.path.includes('routes') && !file.path.includes('route')) {
          continue;
        }

        // Skip known auth route files (their endpoints are intentionally public)
        const fileName = file.path.split(/[/\\]/).pop() || '';
        if (publicRouteFiles.includes(fileName)) {
          continue;
        }

        // Check if file has router-level auth middleware
        const hasRouterLevelAuth = routerLevelAuthPatterns.some((pattern) =>
          pattern.test(file.content),
        );

        // If router-level auth is applied, skip all routes in this file
        if (hasRouterLevelAuth) {
          continue;
        }

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          for (const pattern of routePatterns) {
            if (pattern.test(line)) {
              // Check if it's a public route (absolute path)
              const isPublicAbsolute = publicPatterns.some((p) => line.includes(p));
              if (isPublicAbsolute) continue;

              // Check if it's a relative auth route
              const isRelativeAuth = relativeAuthPatterns.some((p) => line.includes(p));
              if (isRelativeAuth) continue;

              // Get context (current line and next few lines)
              const contextEnd = Math.min(i + 3, file.lines.length);
              const context = file.lines.slice(i, contextEnd).join('\n');

              // Check for auth middleware
              const hasAuth = authPatterns.some((p) => context.includes(p));

              if (!hasAuth) {
                findings.push({
                  file: file.path,
                  lineNumber: i + 1,
                  message: 'Route may be missing authentication middleware',
                  codeSnippet: line.trim().substring(0, 100),
                  suggestedFix:
                    'Add requireAuth or protectedRoute middleware to protect this endpoint',
                });
              }
            }
          }
        }
      }

      return findings;
    },
  },

  // 3. Missing Input Validation
  {
    name: 'Missing Input Validation',
    category: 'input',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        // Only check route files
        if (!file.path.includes('routes')) continue;

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for direct use of req.body without validation
          if (line.includes('req.body') && !line.includes('parse') && !line.includes('validate')) {
            // Check surrounding context for Zod validation
            const startLine = Math.max(0, i - 10);
            const context = file.lines.slice(startLine, i + 5).join('\n');

            // Skip if there's Zod validation nearby
            if (
              context.includes('.parse(') ||
              context.includes('.safeParse(') ||
              context.includes('z.object')
            ) {
              continue;
            }

            // Check for destructuring without validation
            if (line.includes('const {') && line.includes('= req.body')) {
              findings.push({
                file: file.path,
                lineNumber: i + 1,
                message: 'Request body destructured without apparent validation',
                codeSnippet: line.trim().substring(0, 100),
                suggestedFix: 'Use Zod schema.parse(req.body) to validate input before use',
              });
            }
          }

          // Check for req.params without validation
          if (
            line.includes('req.params') &&
            !line.includes('parseInt') &&
            !line.includes('Number(')
          ) {
            const context = file.lines.slice(Math.max(0, i - 5), i + 3).join('\n');
            if (!context.includes('.parse') && !context.includes('z.')) {
              findings.push({
                file: file.path,
                lineNumber: i + 1,
                message: 'URL parameters used without type validation',
                codeSnippet: line.trim().substring(0, 100),
                suggestedFix: 'Validate and sanitize URL parameters before use',
              });
            }
          }
        }
      }

      return findings;
    },
  },

  // 4. Hardcoded Secrets
  {
    name: 'Hardcoded Secrets',
    category: 'auth',
    severity: 'critical',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Patterns that might indicate hardcoded secrets
      const secretPatterns = [
        { regex: /['"`]sk[-_][a-zA-Z0-9]{20,}['"`]/, name: 'Stripe secret key' },
        {
          regex: /['"`]pk[-_](live|test)[-_][a-zA-Z0-9]{20,}['"`]/,
          name: 'Stripe publishable key',
        },
        { regex: /api[-_]?key\s*[:=]\s*['"`][a-zA-Z0-9]{20,}['"`]/i, name: 'API key' },
        { regex: /secret\s*[:=]\s*['"`][a-zA-Z0-9]{16,}['"`]/i, name: 'Secret' },
        { regex: /password\s*[:=]\s*['"`][^'"`,\s]{8,}['"`]/i, name: 'Password' },
        { regex: /jwt[-_]?secret\s*[:=]\s*['"`][a-zA-Z0-9]{16,}['"`]/i, name: 'JWT secret' },
        { regex: /Bearer\s+[a-zA-Z0-9\-_.]{20,}/i, name: 'Bearer token' },
        { regex: /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/, name: 'JWT token' },
      ];

      for (const file of files) {
        // Skip .env files (they're supposed to have secrets)
        if (file.path.includes('.env')) continue;

        // Skip test files
        if (
          file.path.includes('.test.') ||
          file.path.includes('.spec.') ||
          file.path.includes('__test__')
        ) {
          continue;
        }

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

          // Skip example/placeholder values
          if (
            line.includes('example') ||
            line.includes('placeholder') ||
            line.includes('xxx') ||
            line.includes('your-')
          ) {
            continue;
          }

          for (const { regex, name } of secretPatterns) {
            if (regex.test(line)) {
              // Additional check: skip if it's reading from env
              if (line.includes('process.env') || line.includes('env.')) continue;

              findings.push({
                file: file.path,
                lineNumber: i + 1,
                message: `Potential hardcoded ${name} detected`,
                codeSnippet: line.trim().substring(0, 60) + '...',
                suggestedFix: 'Move secrets to environment variables',
              });
            }
          }
        }
      }

      return findings;
    },
  },

  // 5. SQL Injection Patterns
  {
    name: 'SQL Injection Risk',
    category: 'input',
    severity: 'critical',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Patterns that might indicate SQL injection vulnerabilities
      const dangerousPatterns = [
        { regex: /`SELECT\s+.*\$\{.*\}`/i, name: 'Template literal in SELECT' },
        { regex: /`INSERT\s+.*\$\{.*\}`/i, name: 'Template literal in INSERT' },
        { regex: /`UPDATE\s+.*\$\{.*\}`/i, name: 'Template literal in UPDATE' },
        { regex: /`DELETE\s+.*\$\{.*\}`/i, name: 'Template literal in DELETE' },
        { regex: /query\s*\(\s*`[^`]*\$\{/i, name: 'String interpolation in query' },
        { regex: /\.raw\s*\(\s*`[^`]*\$\{/i, name: 'Raw SQL with interpolation' },
      ];

      for (const file of files) {
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          for (const { regex, name } of dangerousPatterns) {
            if (regex.test(line)) {
              findings.push({
                file: file.path,
                lineNumber: i + 1,
                message: `Potential SQL injection: ${name}`,
                codeSnippet: line.trim().substring(0, 80),
                suggestedFix:
                  'Use parameterized queries or ORM methods instead of string interpolation',
              });
            }
          }
        }
      }

      return findings;
    },
  },

  // 6. XSS Vulnerabilities (Frontend)
  {
    name: 'XSS Risk',
    category: 'input',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        // Only check frontend files
        if (
          !file.path.includes('client') &&
          !file.path.endsWith('.tsx') &&
          !file.path.endsWith('.jsx')
        ) {
          continue;
        }

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for dangerouslySetInnerHTML
          if (line.includes('dangerouslySetInnerHTML')) {
            // Check if it's properly sanitized
            const context = file.lines.slice(Math.max(0, i - 5), i + 3).join('\n');
            if (
              !context.includes('sanitize') &&
              !context.includes('DOMPurify') &&
              !context.includes('escape')
            ) {
              findings.push({
                file: file.path,
                lineNumber: i + 1,
                message: 'dangerouslySetInnerHTML used without apparent sanitization',
                codeSnippet: line.trim().substring(0, 80),
                suggestedFix: 'Use DOMPurify or another sanitization library before rendering HTML',
              });
            }
          }

          // Check for innerHTML assignment
          if (line.includes('.innerHTML') && line.includes('=')) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Direct innerHTML assignment may lead to XSS',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix: 'Use textContent or sanitize HTML before insertion',
            });
          }
        }
      }

      return findings;
    },
  },

  // 7. Rate Limiting Check
  {
    name: 'Missing Rate Limiting',
    category: 'rate-limit',
    severity: 'medium',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Check if rate limiting is configured
      let hasRateLimiting = false;
      let rateLimitFile = '';

      for (const file of files) {
        if (
          file.content.includes('rateLimit') ||
          file.content.includes('rate-limit') ||
          file.content.includes('express-rate-limit')
        ) {
          hasRateLimiting = true;
          rateLimitFile = file.path;
          break;
        }
      }

      if (!hasRateLimiting) {
        findings.push({
          file: 'server/',
          message: 'No rate limiting middleware detected',
          suggestedFix: 'Add express-rate-limit or similar middleware to prevent abuse',
        });
      }

      // Check sensitive endpoints for rate limiting
      const sensitivePatterns = [
        '/api/auth/login',
        '/api/auth/signup',
        '/api/auth/forgot',
        '/api/auth/reset',
      ];

      for (const file of files) {
        if (!file.path.includes('routes')) continue;

        for (const pattern of sensitivePatterns) {
          if (file.content.includes(pattern)) {
            // Check if there's rate limiting on this endpoint
            const hasEndpointRateLimit =
              file.content.includes('rateLimit') ||
              file.content.includes('rateLimiter') ||
              file.content.includes('loginLimiter');

            if (!hasEndpointRateLimit && !hasRateLimiting) {
              findings.push({
                file: file.path,
                message: `Sensitive endpoint ${pattern} may lack rate limiting`,
                suggestedFix: 'Add rate limiting to prevent brute force attacks',
              });
            }
          }
        }
      }

      return findings;
    },
  },

  // 8. Sensitive Data Exposure
  {
    name: 'Sensitive Data Exposure',
    category: 'auth',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for logging sensitive data
          if (
            (line.includes('console.log') || line.includes('logger.')) &&
            (line.includes('password') ||
              line.includes('token') ||
              line.includes('secret') ||
              line.includes('apiKey'))
          ) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Potential sensitive data in logs',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix: 'Remove sensitive data from logs or mask it',
            });
          }

          // Check for password in response
          if (
            (line.includes('res.json') || line.includes('res.send')) &&
            line.includes('password')
          ) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Password may be included in API response',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix: 'Exclude password field from response using select or projection',
            });
          }
        }
      }

      return findings;
    },
  },

  // 9. HTTPS/TLS Configuration
  {
    name: 'Insecure HTTP',
    category: 'security',
    severity: 'medium',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for hardcoded HTTP URLs (not localhost)
          if (
            line.includes('http://') &&
            !line.includes('http://localhost') &&
            !line.includes('http://127.0.0.1')
          ) {
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

            // Skip test files
            if (file.path.includes('.test.') || file.path.includes('.spec.')) continue;

            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Hardcoded HTTP URL detected (should use HTTPS)',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix: 'Use HTTPS for all external URLs',
            });
          }
        }
      }

      return findings;
    },
  },

  // 10. Dependency on User Input for Security Decisions
  {
    name: 'Client-Side Security Decision',
    category: 'auth',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      for (const file of files) {
        // Check server files
        if (!file.path.includes('server')) continue;

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for role/permission from request body/query
          if (
            line.includes('req.body.role') ||
            line.includes('req.body.isAdmin') ||
            line.includes('req.query.role') ||
            line.includes('req.body.permission')
          ) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Security decision based on client-provided role/permission',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix:
                'Derive roles and permissions from authenticated session, not request body',
            });
          }
        }
      }

      return findings;
    },
  },

  // 11. Missing Authorization/RBAC Check
  // Routes that have authentication but no permission/role verification
  {
    name: 'Missing Authorization Check',
    category: 'auth',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Authorization patterns that verify WHAT the user can do
      const authzPatterns = [
        'requirePermission',
        'hasPermission',
        'checkPermission',
        'roleLevel',
        'isAdmin',
        'isPlatformAdmin',
        'canAccess',
        'authorize',
        'checkAccess',
        'verifyAccess',
        'ensurePermission',
      ];

      // Sensitive operations that typically need authorization beyond just authentication
      const sensitiveOperations = [
        /\.(delete|remove|destroy)\s*\(/i,
        /\.update\s*\(/i,
        /\.create\s*\(/i,
        /\.insert\s*\(/i,
        /DELETE\s+FROM/i,
        /UPDATE\s+.*SET/i,
        /INSERT\s+INTO/i,
      ];

      // Routes/files that are known to require only authentication (no fine-grained authz)
      const exemptPatterns = ['auth-routes', '/profile', '/settings', '/preferences'];

      for (const file of files) {
        // Only check route files in server
        if (!file.path.includes('server')) continue;
        if (!file.path.includes('routes')) continue;

        // Skip exempt files
        if (exemptPatterns.some((p) => file.path.includes(p))) continue;

        // Check if file has any authorization patterns
        const hasAuthz = authzPatterns.some((p) => file.content.includes(p));

        // If file has auth but no authz, flag sensitive operations
        if (!hasAuthz) {
          for (let i = 0; i < file.lines.length; i++) {
            const line = file.lines[i];

            // Check for sensitive database operations
            for (const pattern of sensitiveOperations) {
              if (pattern.test(line)) {
                // Get surrounding context to check for inline permission checks
                const startLine = Math.max(0, i - 15);
                const endLine = Math.min(file.lines.length, i + 5);
                const context = file.lines.slice(startLine, endLine).join('\n');

                // Skip if there's an authorization check in context
                if (authzPatterns.some((p) => context.includes(p))) continue;

                findings.push({
                  file: file.path,
                  lineNumber: i + 1,
                  message: 'Sensitive operation without authorization check (only auth, no RBAC)',
                  codeSnippet: line.trim().substring(0, 80),
                  suggestedFix:
                    'Add requirePermission middleware or verify user permissions before sensitive operations',
                });
                break; // Only report once per line
              }
            }
          }
        }
      }

      return findings;
    },
  },

  // 12. Missing Tenant Isolation in Database Operations
  // Database queries that don't filter by tenantId
  {
    name: 'Missing Tenant Isolation',
    category: 'tenant',
    severity: 'critical',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Database operation patterns
      const dbOperationPatterns = [
        /db\.query\./,
        /db\.select\(/,
        /\.findMany\(/,
        /\.findFirst\(/,
        /\.findUnique\(/,
        /\.update\(/,
        /\.delete\(/,
        /\.deleteMany\(/,
        /\.updateMany\(/,
      ];

      // Tenant filtering patterns
      const tenantPatterns = [
        'tenantId',
        'tenant_id',
        'getTenantId',
        'req.tenantId',
        'user.tenantId',
      ];

      // Tables that are global (don't need tenant filtering)
      const globalTablePatterns = [
        'users',
        'sessions',
        'tenants',
        'roles',
        'permissions',
        'subscriptionPlans',
        'systemSettings',
        'platformSettings',
        'knowledgeBase',
      ];

      for (const file of files) {
        // Only check server files
        if (!file.path.includes('server')) continue;
        // Skip test files
        if (file.path.includes('.test.') || file.path.includes('.spec.')) continue;
        // Skip migration files
        if (file.path.includes('migration')) continue;

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for database operations
          const hasDbOperation = dbOperationPatterns.some((p) => p.test(line));
          if (!hasDbOperation) continue;

          // Check if it's a global table operation
          const isGlobalTable = globalTablePatterns.some((t) => line.includes(t));
          if (isGlobalTable) continue;

          // Look for tenant filtering in surrounding context (30 lines before, 10 after)
          const startLine = Math.max(0, i - 30);
          const endLine = Math.min(file.lines.length, i + 10);
          const context = file.lines.slice(startLine, endLine).join('\n');

          // Check for tenant filtering
          const hasTenantFilter = tenantPatterns.some((p) => context.includes(p));

          if (!hasTenantFilter) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message:
                'Database operation may be missing tenant isolation (no tenantId filter found)',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix: 'Add tenantId filter: where: { tenantId: getTenantId(req), ... }',
            });
          }
        }
      }

      return findings;
    },
  },

  // 13. Missing Resource Ownership Verification
  // Accessing resources by ID without verifying the user owns them
  {
    name: 'Missing Ownership Check',
    category: 'auth',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Patterns for getting resource by ID from request
      const idFromRequestPatterns = [
        /req\.params\.id/,
        /req\.params\.\w+Id/,
        /req\.query\.id/,
        /const\s*{\s*id\s*}\s*=\s*req\.params/,
      ];

      // Ownership verification patterns
      const ownershipPatterns = [
        'createdBy',
        'userId',
        'ownerId',
        'owner',
        'belongsTo',
        'getUserId',
        'req.user.id',
        'user.id',
        'assignedTo',
      ];

      // Route patterns that typically need ownership checks
      const sensitiveRoutePatterns = [
        /\.(put|patch|delete)\s*\(\s*['"`][^'"]+:id/,
        /\.(put|patch|delete)\s*\(\s*['"`][^'"]+:\w+Id/,
      ];

      for (const file of files) {
        // Only check route files in server
        if (!file.path.includes('server')) continue;
        if (!file.path.includes('routes')) continue;

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for sensitive route with ID parameter
          const isSensitiveRoute = sensitiveRoutePatterns.some((p) => p.test(line));
          if (!isSensitiveRoute) continue;

          // Look at the route handler body (next 50 lines)
          const endLine = Math.min(file.lines.length, i + 50);
          const handlerBody = file.lines.slice(i, endLine).join('\n');

          // Check if there's an ID from request being used
          const usesIdFromRequest = idFromRequestPatterns.some((p) => p.test(handlerBody));
          if (!usesIdFromRequest) continue;

          // Check for ownership verification
          const hasOwnershipCheck = ownershipPatterns.some((p) => handlerBody.includes(p));

          // Also check for permission-based access (alternative to ownership)
          const hasPermissionCheck =
            handlerBody.includes('requirePermission') ||
            handlerBody.includes('hasPermission') ||
            handlerBody.includes('_all') || // view_all, edit_all permissions
            handlerBody.includes('_team'); // view_team permissions

          if (!hasOwnershipCheck && !hasPermissionCheck) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'Route modifies resource by ID without ownership verification',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix:
                'Verify resource.createdBy === userId or use permission scopes (view_own, edit_own)',
            });
          }
        }
      }

      return findings;
    },
  },

  // 14. Direct ID Access Without Validation
  // Using IDs directly from request without checking they belong to the user's tenant/scope
  {
    name: 'Unsafe ID Parameter Usage',
    category: 'auth',
    severity: 'high',
    check: (files) => {
      const findings: SecurityFinding[] = [];

      // Patterns for directly using ID from request in queries
      const directIdUsagePatterns = [
        /where.*id.*req\.params/,
        /\.findFirst\(\s*{\s*where:\s*{\s*id:\s*\w+\s*}/,
        /eq\s*\(\s*\w+\.id\s*,\s*\w+\s*\)/,
      ];

      // Safe patterns (validates tenant/ownership)
      const safePatterns = [
        'tenantId',
        'and(', // Using Drizzle's and() for multiple conditions
        'createdBy',
        'userId',
      ];

      for (const file of files) {
        if (!file.path.includes('server')) continue;
        if (!file.path.includes('routes')) continue;

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];

          // Check for direct ID usage
          const hasDirectId = directIdUsagePatterns.some((p) => p.test(line));
          if (!hasDirectId) continue;

          // Get surrounding context
          const startLine = Math.max(0, i - 5);
          const endLine = Math.min(file.lines.length, i + 5);
          const context = file.lines.slice(startLine, endLine).join('\n');

          // Check for safe patterns
          const hasSafePattern = safePatterns.some((p) => context.includes(p));

          if (!hasSafePattern) {
            findings.push({
              file: file.path,
              lineNumber: i + 1,
              message: 'ID used directly in query without tenant/ownership validation',
              codeSnippet: line.trim().substring(0, 80),
              suggestedFix:
                'Always include tenantId in query: where: and(eq(table.id, id), eq(table.tenantId, tenantId))',
            });
          }
        }
      }

      return findings;
    },
  },
];

// ============================================================================
// Main Audit Logic
// ============================================================================

async function runAudit(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              SECURITY AUDIT                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  // Step 1: Scan files
  console.log('📂 Scanning source files...\n');

  const serverFiles = scanDirectory(SERVER_DIR, ['.ts', '.js']);
  const clientFiles = scanDirectory(CLIENT_DIR, ['.ts', '.tsx', '.js', '.jsx']);
  const rootFiles = scanDirectory(ROOT_DIR, ['.ts', '.js', '.json']).filter(
    (f) => !f.path.includes('server') && !f.path.includes('client'),
  );

  const allFiles = [...serverFiles, ...clientFiles, ...rootFiles];
  console.log(`   Server files: ${serverFiles.length}`);
  console.log(`   Client files: ${clientFiles.length}`);
  console.log(`   Root files: ${rootFiles.length}`);
  console.log(`   Total: ${allFiles.length}\n`);

  // Step 2: Run security checks
  console.log('🔒 Running security checks...\n');

  const results: SecurityTestResult[] = [];
  const allIssues: AuditIssue[] = [];

  for (const check of securityChecks) {
    if (verbose) {
      process.stdout.write(`   Checking: ${check.name}...`);
    }

    const findings = check.check(allFiles);

    const passed = findings.length === 0;

    results.push({
      category: check.category,
      name: check.name,
      passed,
      details: passed ? 'No issues found' : `Found ${findings.length} potential issues`,
      severity: passed ? undefined : check.severity,
    });

    for (const finding of findings) {
      allIssues.push(
        createIssue(
          check.category === 'cors' || check.category === 'auth' || check.category === 'tenant'
            ? check.category
            : 'security',
          check.severity,
          finding.message,
          finding.file,
          {
            sourceFile: finding.file,
            lineNumber: finding.lineNumber,
            suggestedFix: finding.suggestedFix,
          },
        ),
      );
    }

    if (verbose) {
      console.log(passed ? ' ✓' : ` ✗ (${findings.length} issues)`);
    }
  }

  if (verbose) console.log('');

  // Step 3: Generate report
  const duration = Date.now() - startTime;

  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const highIssues = allIssues.filter((i) => i.severity === 'high');
  const mediumIssues = allIssues.filter((i) => i.severity === 'medium');

  const report: AuditReport = {
    type: 'security',
    timestamp: new Date(),
    duration,
    summary: {
      total: securityChecks.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed && r.severity === 'critical').length,
      warnings: results.filter((r) => !r.passed && r.severity !== 'critical').length,
      skipped: 0,
    },
    issues: allIssues,
    data: {
      checks: results,
      stats: {
        totalFiles: allFiles.length,
        serverFiles: serverFiles.length,
        clientFiles: clientFiles.length,
        totalIssues: allIssues.length,
        bySeverity: {
          critical: criticalIssues.length,
          high: highIssues.length,
          medium: mediumIssues.length,
          low: allIssues.filter((i) => i.severity === 'low').length,
        },
        byCategory: {
          cors: allIssues.filter((i) => i.category === 'cors').length,
          auth: allIssues.filter((i) => i.category === 'auth').length,
          security: allIssues.filter((i) => i.category === 'security').length,
        },
      },
    },
  };

  const { jsonPath, mdPath } = generateReport(report);

  // Step 4: Print summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Security Checks:     ${String(securityChecks.length).padStart(35)} ║`);
  console.log(
    `║  Passed:              ${String(results.filter((r) => r.passed).length).padStart(35)} ║`,
  );
  console.log(
    `║  Failed:              ${String(results.filter((r) => !r.passed).length).padStart(35)} ║`,
  );
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Critical Issues:     ${String(criticalIssues.length).padStart(35)} ║`);
  console.log(`║  High Issues:         ${String(highIssues.length).padStart(35)} ║`);
  console.log(`║  Medium Issues:       ${String(mediumIssues.length).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:            ${formatDuration(duration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print check results
  console.log('Security Check Results:\n');
  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? '🟢' : result.severity === 'critical' ? '🔴' : '🟠';
    console.log(`   ${color} ${icon} ${result.name}: ${result.details}`);
  }
  console.log('');

  // Print critical issues
  if (criticalIssues.length > 0) {
    console.log(`🔴 Critical Issues (${criticalIssues.length}):`);
    criticalIssues.slice(0, 10).forEach((i) => {
      console.log(`   - ${i.message}`);
      console.log(`     File: ${i.sourceFile}${i.lineNumber ? `:${i.lineNumber}` : ''}`);
    });
    if (criticalIssues.length > 10) {
      console.log(`   ... and ${criticalIssues.length - 10} more`);
    }
    console.log('');
  }

  // Print high issues
  if (highIssues.length > 0) {
    console.log(`🟠 High Priority Issues (${highIssues.length}):`);
    highIssues.slice(0, 5).forEach((i) => {
      console.log(`   - ${i.message}`);
      console.log(`     File: ${i.sourceFile}${i.lineNumber ? `:${i.lineNumber}` : ''}`);
    });
    if (highIssues.length > 5) {
      console.log(`   ... and ${highIssues.length - 5} more`);
    }
    console.log('');
  }

  console.log(`📄 Reports saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);

  // Exit with error code if there are critical issues
  if (criticalIssues.length > 0) {
    process.exit(1);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Entry Point
// ============================================================================

runAudit().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
