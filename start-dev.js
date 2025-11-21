// Simple dev server starter for Windows
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/printyx';
process.env.PORT = process.env.PORT || '5000';

// Replit-specific environment variables for local development
process.env.REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || 'localhost';
process.env.REPL_ID = process.env.REPL_ID || 'local-dev';
process.env.ISSUER_URL = process.env.ISSUER_URL || 'https://replit.com/oidc';

// Optional API keys for testing (use placeholder values)
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-placeholder';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-placeholder';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-development';

console.log('Starting Printyx application in development mode...');
console.log('Environment variables set:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Windows compatibility: reusePort is not supported
process.env.WINDOWS_COMPAT = 'true';

console.log('Note: Running in Windows compatibility mode (reusePort disabled)');

// Import and run the server
import('./server/index.ts');
