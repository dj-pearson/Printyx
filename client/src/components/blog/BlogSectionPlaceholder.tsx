import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LucideIcon } from 'lucide-react';

/**
 * Generic empty-state placeholder for blog sub-sections that haven't been
 * implemented yet. Each section page (Ideas, Briefs, Posts, Distribution,
 * Analytics, Refresh) renders this until the real CRUD/UI lands in its
 * dedicated story.
 */
interface BlogSectionPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  storyIds: string[];
  /** Optional CTA shown below the description card. */
  cta?: ReactNode;
  /** Bullet list of what this section will eventually contain. */
  capabilities?: string[];
}

export function BlogSectionPlaceholder({
  title,
  description,
  icon: Icon,
  storyIds,
  cta,
  capabilities,
}: BlogSectionPlaceholderProps) {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          {storyIds.map((id) => (
            <Badge key={id} variant="secondary" className="text-xs font-mono">
              {id}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
      </header>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Empty</CardTitle>
          <CardDescription>
            This section is part of the blog admin shell scaffolded by US-BLOG-007. The actual
            features land in subsequent stories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilities && capabilities.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
              {capabilities.map((cap) => (
                <li key={cap}>{cap}</li>
              ))}
            </ul>
          ) : null}
          {cta}
        </CardContent>
      </Card>
    </div>
  );
}

export default BlogSectionPlaceholder;
