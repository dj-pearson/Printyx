// Utility functions for URL slug generation and handling
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export function createUniqueSlug(name: string, existingNames: string[], suffix?: number): string {
  const baseSlug = createSlug(name);
  const candidateSlug = suffix ? `${baseSlug}-${suffix}` : baseSlug;
  
  // Check if this slug already exists
  const exists = existingNames.some(existing => createSlug(existing) === candidateSlug);
  
  if (!exists) {
    return candidateSlug;
  }
  
  // If it exists, try with incremented suffix
  return createUniqueSlug(name, existingNames, (suffix || 0) + 1);
}

export function findBySlug<T extends { businessName?: string; companyName?: string; name?: string }>(
  items: T[], 
  slug: string
): T | undefined {
  return items.find(item => {
    const name = item.businessName || item.companyName || item.name || '';
    return createSlug(name) === slug;
  });
}