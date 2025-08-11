import React from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  maxWidth?: number;
  sizes?: string;
};

export function OptimizedImage({ maxWidth, sizes, src, alt = "", ...rest }: Props) {
  const computedSizes = sizes || "(max-width: 640px) 100vw, 50vw";
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      sizes={computedSizes}
      {...rest}
    />
  );
}


