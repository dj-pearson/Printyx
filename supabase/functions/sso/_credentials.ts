// Redacts sensitive SSO provider fields before returning to frontend.
// Called on every response path that includes a provider row.

const SENSITIVE = [
  'oidcClientSecret',
  'oidc_client_secret',
  'samlCertificate',
  'saml_certificate',
  'samlCertificateFingerprint',
  'saml_certificate_fingerprint',
] as const;

export function redactProvider<T extends Record<string, unknown>>(p: T): T {
  const out = { ...p };
  for (const k of SENSITIVE) {
    if (out[k] !== undefined && out[k] !== null && out[k] !== '') {
      (out as Record<string, unknown>)[k] = '••••••••';
    }
  }
  return out;
}
