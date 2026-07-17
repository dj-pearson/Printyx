import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Construction } from 'lucide-react';

/**
 * Explicit "not built yet" state for a ROUTED page whose backend does not exist
 * (AUDIT-015).
 *
 * WHY THIS EXISTS: several routed pages rendered hardcoded fixtures — fake
 * technicians, invented alerts, NYC coordinates, made-up metrics — with no API call
 * anywhere behind them. That is worse than an empty page: it is indistinguishable
 * from real data, so it rots into false "this feature exists" signal for users and
 * for whoever plans the roadmap. Per AUDIT-015's own rule, a page with no backend
 * gets an honest placeholder instead of fixtures presented as real.
 *
 * Generalized from components/blog/BlogSectionPlaceholder (same idea, blog-specific).
 * Use this when the feature is genuinely unbuilt; if a real endpoint exists, wire it
 * instead of reaching for this.
 */
export interface ComingSoonProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** PRD story ids that will deliver this, so the placeholder is traceable. */
  storyIds?: string[];
  /** What the page will do once implemented. */
  capabilities?: string[];
  /** Optional note on why it is gated (e.g. which backend is missing). */
  note?: string;
}

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
  storyIds,
  capabilities,
  note,
}: ComingSoonProps) {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="secondary">Coming soon</Badge>
          {storyIds?.map((id) => (
            <Badge key={id} variant="outline" className="text-xs font-mono">
              {id}
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">This feature isn't available yet</CardTitle>
          <CardDescription>
            Nothing on this page is live data. It has been gated rather than showing placeholder
            numbers that could be mistaken for your own.
          </CardDescription>
        </CardHeader>
        {(capabilities?.length || note) && (
          <CardContent className="space-y-4">
            {capabilities?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Planned capabilities</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default ComingSoon;
