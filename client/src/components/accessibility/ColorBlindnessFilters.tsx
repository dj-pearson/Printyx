/**
 * Color Blindness SVG Filters
 * WCAG 2.1 Level A - Use of Color (1.4.1)
 *
 * Provides SVG filters for simulating color blindness to help users
 * who have various types of color vision deficiency.
 */

export function ColorBlindnessFilters() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="sr-only"
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* Protanopia (Red-Blind) - Difficulty distinguishing red and green */}
        <filter id="protanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0     0 0
                    0.558 0.442 0     0 0
                    0     0.242 0.758 0 0
                    0     0     0     1 0"
          />
        </filter>

        {/* Deuteranopia (Green-Blind) - Difficulty distinguishing red and green */}
        <filter id="deuteranopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0   0 0
                    0.7   0.3   0   0 0
                    0     0.3   0.7 0 0
                    0     0     0   1 0"
          />
        </filter>

        {/* Tritanopia (Blue-Blind) - Difficulty distinguishing blue and yellow */}
        <filter id="tritanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05  0     0 0
                    0    0.433 0.567 0 0
                    0    0.475 0.525 0 0
                    0    0     0     1 0"
          />
        </filter>

        {/* Monochromacy/Achromatopsia - No color perception (handled via CSS grayscale) */}
      </defs>
    </svg>
  );
}

export default ColorBlindnessFilters;
