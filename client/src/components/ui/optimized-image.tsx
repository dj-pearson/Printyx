import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ImageSource {
  srcSet: string;
  type?: string;
}

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'alt'> & {
  /** Alt text is required for accessibility */
  alt: string;
  maxWidth?: number;
  sizes?: string;
  /** Responsive image srcSet (e.g. "image-400.jpg 400w, image-800.jpg 800w") */
  srcSet?: string;
  /** Additional sources for picture element (e.g. WebP variants) */
  sources?: ImageSource[];
};

/**
 * Optimized image component with responsive srcSet, WebP support via picture element,
 * required alt text, and a skeleton loading placeholder.
 *
 * @example
 * // Simple usage
 * <OptimizedImage src="/photo.jpg" alt="Team photo" />
 *
 * @example
 * // With responsive srcSet
 * <OptimizedImage
 *   src="/photo.jpg"
 *   alt="Team photo"
 *   srcSet="/photo-400.webp 400w, /photo-800.webp 800w"
 *   sizes="(max-width: 640px) 100vw, 50vw"
 * />
 *
 * @example
 * // With WebP + fallback via sources
 * <OptimizedImage
 *   src="/photo.jpg"
 *   alt="Team photo"
 *   sources={[{ srcSet: "/photo.webp", type: "image/webp" }]}
 * />
 */
export function OptimizedImage({
  maxWidth,
  sizes,
  src,
  alt,
  srcSet,
  sources,
  className,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const computedSizes = sizes || '(max-width: 640px) 100vw, 50vw';

  const imgEl = (
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      sizes={computedSizes}
      srcSet={srcSet}
      onLoad={() => setLoaded(true)}
      className={cn(
        'transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...rest}
    />
  );

  const placeholder = !loaded && (
    <div className="absolute inset-0 bg-muted animate-pulse rounded" aria-hidden="true" />
  );

  if (sources && sources.length > 0) {
    return (
      <span className="relative inline-block">
        {placeholder}
        <picture>
          {sources.map((source, i) => (
            <source key={i} srcSet={source.srcSet} type={source.type} sizes={computedSizes} />
          ))}
          {imgEl}
        </picture>
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      {placeholder}
      {imgEl}
    </span>
  );
}
