// Jest setup — runs after the test framework is installed but before each
// test module's imports are evaluated.
//
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
