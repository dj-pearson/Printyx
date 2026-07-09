// Ambient declarations for OPTIONAL cloud-backend SDKs that are loaded via
// dynamic `await import(...)` only when the corresponding secrets backend is
// configured. They are intentionally NOT in package.json dependencies (they
// would pull in a large, cloud-specific SDK for a feature most deployments do
// not use). Declaring them here lets TypeScript resolve the dynamic import as
// `any` so the codebase typechecks without installing the SDK.
declare module '@aws-sdk/client-secrets-manager';
