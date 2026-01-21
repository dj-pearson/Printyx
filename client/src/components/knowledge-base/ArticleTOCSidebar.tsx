import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TOCItem {
  id: string;
  title: string;
  level: number;
  order: number;
  children?: TOCItem[];
}

interface TableOfContents {
  items: TOCItem[];
  totalSections: number;
  estimatedReadingTime: number;
}

interface ArticleTOCSidebarProps {
  tableOfContents: TableOfContents;
  currentSectionId?: string;
  className?: string;
}

export default function ArticleTOCSidebar({
  tableOfContents,
  currentSectionId,
  className,
}: ArticleTOCSidebarProps) {
  const [activeSection, setActiveSection] = useState<string>(currentSectionId || '');
  const [readingProgress, setReadingProgress] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  // Flatten TOC for progress calculation
  const flattenTOC = (items: TOCItem[]): TOCItem[] => {
    const flat: TOCItem[] = [];
    const traverse = (items: TOCItem[]) => {
      for (const item of items) {
        flat.push(item);
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(items);
    return flat;
  };

  const flatTOC = flattenTOC(tableOfContents.items);

  // Calculate reading progress based on active section
  useEffect(() => {
    if (activeSection) {
      const index = flatTOC.findIndex((item) => item.id === activeSection);
      if (index !== -1) {
        const progress = ((index + 1) / flatTOC.length) * 100;
        setReadingProgress(Math.round(progress));
      }
    }
  }, [activeSection, flatTOC]);

  // Intersection Observer to track active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id) {
              setActiveSection(id);
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px', // Activate when section is in middle of viewport
        threshold: 0,
      },
    );

    // Observe all headers with IDs
    flatTOC.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [flatTOC]);

  // Track scroll position for sticky behavior
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSectionClick = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Header offset
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      setActiveSection(sectionId);
    }
  };

  const renderTOCItem = (item: TOCItem, level: number = 0) => {
    const isActive = activeSection === item.id;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id} className="space-y-1">
        <button
          onClick={() => handleSectionClick(item.id)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            isActive && 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium',
            !isActive && 'text-gray-700 dark:text-gray-300',
            level === 0 && 'font-medium',
            level === 1 && 'pl-6 text-sm',
            level === 2 && 'pl-9 text-xs',
          )}
        >
          <div className="flex items-center gap-2">
            {isActive && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
            <span className={cn('line-clamp-2', !isActive && level > 0 && 'ml-5')}>
              {item.title}
            </span>
          </div>
        </button>

        {hasChildren && (
          <div className="ml-3 border-l border-gray-200 dark:border-gray-700 pl-1">
            {item.children!.map((child) => renderTOCItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Sticky wrapper */}
      <div className={cn('transition-all', isSticky && 'sticky top-20')}>
        <Card className="p-4 bg-white dark:bg-gray-900 shadow-sm">
          {/* Header */}
          <div className="mb-4 pb-4 border-b">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Table of Contents
            </h2>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{tableOfContents.totalSections} sections</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{tableOfContents.estimatedReadingTime} min read</span>
              </div>
            </div>

            {/* Reading Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Reading Progress</span>
                <Badge variant="secondary" className="text-xs">
                  {readingProgress}%
                </Badge>
              </div>
              <Progress value={readingProgress} className="h-2" />
            </div>
          </div>

          {/* TOC Items */}
          <ScrollArea className="h-[calc(100vh-400px)] pr-3">
            <nav className="space-y-1">
              {tableOfContents.items.map((item) => renderTOCItem(item))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
              <span className="min-w-[40px] text-right font-medium">{readingProgress}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions (optional) */}
      <Card className="p-3 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="text-xs text-blue-800 dark:text-blue-200 space-y-2">
          <p className="font-medium">💡 Tip:</p>
          <p>Click any section title to jump directly to that part of the article.</p>
        </div>
      </Card>
    </div>
  );
}
