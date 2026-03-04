/**
 * Bot Signatures Configuration (SEC-014)
 *
 * Defines patterns for known security tools, legitimate crawlers,
 * and headless browser indicators used by the bot detection middleware.
 */

export interface ToolSignature {
  name: string;
  pattern: RegExp;
}

export interface CrawlerSignature {
  name: string;
  uaPattern: RegExp;
}

/**
 * Known security/scanning tool User-Agent patterns.
 * Matching any of these indicates automated security scanning.
 */
export const KNOWN_TOOL_SIGNATURES: ToolSignature[] = [
  { name: 'nmap', pattern: /nmap/i },
  { name: 'nikto', pattern: /nikto/i },
  { name: 'sqlmap', pattern: /sqlmap/i },
  { name: 'whatweb', pattern: /whatweb/i },
  { name: 'schemathesis', pattern: /schemathesis/i },
  { name: 'nuclei', pattern: /nuclei/i },
  { name: 'burpsuite', pattern: /burp\s*suite/i },
  { name: 'zap', pattern: /\bZAP\b|OWASP[\s-]*ZAP/i },
  { name: 'wfuzz', pattern: /wfuzz/i },
  { name: 'gobuster', pattern: /gobuster/i },
  { name: 'dirbuster', pattern: /dirbuster/i },
  { name: 'ffuf', pattern: /\bffuf\b/i },
];

/**
 * Legitimate crawler User-Agent patterns.
 * These are allowlisted and should not be flagged as bots.
 */
export const LEGITIMATE_CRAWLERS: CrawlerSignature[] = [
  { name: 'Googlebot', uaPattern: /Googlebot/i },
  { name: 'Bingbot', uaPattern: /bingbot/i },
  { name: 'Slackbot', uaPattern: /Slackbot/i },
  { name: 'Twitterbot', uaPattern: /Twitterbot/i },
  { name: 'facebookexternalhit', uaPattern: /facebookexternalhit/i },
];

/**
 * Patterns that indicate headless browser usage.
 */
export const HEADLESS_INDICATORS: RegExp[] = [
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Headless/i,
  /puppeteer/i,
  /playwright/i,
];
