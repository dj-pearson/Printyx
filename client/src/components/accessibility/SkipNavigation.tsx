/**
 * Skip Navigation Component
 * WCAG 2.1 Level A - Bypass Blocks (2.4.1)
 *
 * Provides skip links for keyboard users to bypass repeated blocks of content.
 * This is essential for users who navigate with keyboards or screen readers.
 */

import { useCallback } from 'react';

interface SkipLink {
  id: string;
  label: string;
}

interface SkipNavigationProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'navigation', label: 'Skip to navigation' },
  { id: 'search', label: 'Skip to search' },
];

export function SkipNavigation({ links = defaultLinks }: SkipNavigationProps) {
  const handleSkip = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <nav aria-label="Skip navigation" className="skip-navigation">
      <ul className="skip-navigation-list">
        {links.map((link) => (
          <li key={link.id}>
            <a href={`#${link.id}`} onClick={(e) => handleSkip(e, link.id)} className="skip-link">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Skip Target Component
 * Use this to mark content sections that can be skipped to.
 */
interface SkipTargetProps {
  id: string;
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

export function SkipTarget({ id, children, as: Component = 'div' }: SkipTargetProps) {
  return (
    <Component id={id} tabIndex={-1} className="skip-target">
      {children}
    </Component>
  );
}

export default SkipNavigation;
