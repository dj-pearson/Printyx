// Jest setup — runs after the test framework is installed but before each
// test module's imports are evaluated.
//
// @supabase/realtime-js needs a global `WebSocket` constructor, which it reads
// when `createClient` runs at module-import time (src/lib/supabase.ts). Node 22
// has one natively, but Node 20 (used by mobile-ci) does not, so the Supabase
// client throws "Node.js 20 detected without native WebSocket support" and tanks
// the suite. React Native supplies WebSocket at runtime; provide the standard
// `ws` polyfill here so the client loads under jest on any Node version.
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  globalThis.WebSocket = require('ws');
}

// jest-expo mocks most native Expo modules, but expo-crypto's `randomUUID`
// resolves to `undefined` in the test environment. Several modules call it at
// import time (e.g. remoteLogger builds a device/session id), which throws
// "Cannot read properties of undefined (reading 'slice')" and tanks the whole
// suite. Provide a deterministic stub so those modules load cleanly.
jest.mock('expo-crypto', () => {
  const actual = jest.requireActual('expo-crypto');
  let counter = 0;
  return {
    ...actual,
    randomUUID: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`,
  };
});
