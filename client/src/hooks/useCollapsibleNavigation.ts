import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export interface NavigationSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavigationItem[];
  matchPatterns?: string[]; // Route patterns that should expand this section
}

export interface NavigationItem {
  title: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function useCollapsibleNavigation(sections: NavigationSection[]) {
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userExpandedSections, setUserExpandedSections] = useState<Set<string>>(new Set());

  // Determine which section should be expanded based on current route
  useEffect(() => {
    const currentSection = sections.find(section => {
      // Check if current route matches the section's main path
      if (location === section.path) return true;
      
      // Check if current route matches any of the section's match patterns
      if (section.matchPatterns) {
        return section.matchPatterns.some(pattern => {
          // Convert pattern to regex (e.g., "/crm*" -> /^\/crm/)
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}`);
          return regex.test(location);
        });
      }

      // Check if current route matches any child path
      if (section.children) {
        return section.children.some(child => location === child.path);
      }

      return false;
    });

    // Update expanded sections based on route
    setExpandedSections(prevExpanded => {
      const newExpanded = new Set<string>();
      
      // Always keep user-expanded sections open
      userExpandedSections.forEach(sectionId => {
        newExpanded.add(sectionId);
      });

      // Add current section if it should be expanded
      if (currentSection) {
        newExpanded.add(currentSection.id);
      }

      return newExpanded;
    });
  }, [location, sections, userExpandedSections]);

  const toggleSection = (sectionId: string) => {
    setUserExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });

    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isExpanded = (sectionId: string) => expandedSections.has(sectionId);

  const isActive = (path: string) => location === path;

  const getActiveSection = () => {
    return sections.find(section => {
      if (location === section.path) return true;
      
      if (section.matchPatterns) {
        return section.matchPatterns.some(pattern => {
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}`);
          return regex.test(location);
        });
      }

      if (section.children) {
        return section.children.some(child => location === child.path);
      }

      return false;
    });
  };

  return {
    expandedSections,
    toggleSection,
    isExpanded,
    isActive,
    getActiveSection,
    currentLocation: location
  };
}

export default useCollapsibleNavigation;