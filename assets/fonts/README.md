# Build-only fonts

Manrope (SIL Open Font License 1.1), vendored so `scripts/generate-social-images.mjs`
renders the same Open Graph card on any machine. These files are **not** served to
users - they live outside `client/public` on purpose and are read off disk by the
generator.

Source: https://fonts.google.com/specimen/Manrope
