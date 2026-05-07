// Blog CMS Adapter Registry (US-BLOG-006)
//
// Single export point for all CMS adapters. Future adapters (Webflow,
// custom-REST, native-render-into-printyx.net) register themselves here.

import type { CmsAdapter } from './adapter.ts';
import { wordpressAdapter } from './wordpress.ts';
import { ghostAdapter } from './ghost.ts';

export const CMS_PLATFORMS = ['wordpress', 'ghost'] as const;
export type CmsPlatform = (typeof CMS_PLATFORMS)[number];

const REGISTRY: Record<CmsPlatform, CmsAdapter> = {
  wordpress: wordpressAdapter,
  ghost: ghostAdapter,
};

export function getCmsAdapter(platform: string): CmsAdapter | null {
  return (REGISTRY as Record<string, CmsAdapter>)[platform] ?? null;
}

export function isCmsPlatform(platform: string): platform is CmsPlatform {
  return (CMS_PLATFORMS as readonly string[]).includes(platform);
}

export type {
  CmsAdapter,
  CmsAsset,
  CmsCredentials,
  CmsHealthCheckResult,
  CmsListOptions,
  CmsPost,
  CmsPostInput,
} from './adapter.ts';
export { AdapterError, AdapterAuthError, AdapterUnsupportedError } from './adapter.ts';
