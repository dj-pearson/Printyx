/**
 * Lazy-loaded utility for looking up US ZIP code centroids (lat/lng).
 * Data is fetched once from /data/us-zip-centroids.json and cached.
 */

let centroidCache: Record<string, [number, number]> | null = null;
let loadPromise: Promise<Record<string, [number, number]>> | null = null;

export async function loadZipCentroids(): Promise<Record<string, [number, number]>> {
  if (centroidCache) return centroidCache;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/us-zip-centroids.json')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load zip centroids');
      return res.json();
    })
    .then((data: Record<string, [number, number]>) => {
      centroidCache = data;
      return data;
    })
    .catch((err) => {
      console.error('Error loading zip centroids:', err);
      loadPromise = null;
      return {} as Record<string, [number, number]>;
    });

  return loadPromise;
}

export function getZipCentroid(
  zip: string,
  centroids: Record<string, [number, number]>,
): [number, number] | null {
  if (!zip) return null;

  // Normalize to 5 digits
  const normalized = zip.trim().substring(0, 5);

  // Exact match
  if (centroids[normalized]) return centroids[normalized];

  // Try 3-digit prefix match (for approximate location)
  const prefix = normalized.substring(0, 3);
  const prefixMatch = Object.keys(centroids).find((k) => k.startsWith(prefix));
  if (prefixMatch) return centroids[prefixMatch];

  return null;
}
