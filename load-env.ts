/**
 * Environment Variable Loader
 *
 * This file loads environment variables from .env file
 * and makes them available to the application.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
const result = config({ path: resolve(process.cwd(), '.env') });

if (result.error) {
  console.warn('⚠️ No .env file found or error loading it:', result.error.message);
  console.warn('⚠️ Make sure you have a .env file in the project root');
} else {
  console.log('✅ Environment variables loaded from .env file');

  // Verify critical variables are set
  const criticalVars = ['DATABASE_URL'];
  const missing = criticalVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ Missing critical environment variables:', missing.join(', '));
    console.error('❌ Please run: .\\setup-supabase-env.ps1');
  } else {
    console.log('✅ All critical environment variables are set');
  }
}

export {};
