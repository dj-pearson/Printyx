import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles, Wrench } from 'lucide-react';

/**
 * Blog Module — Platform Admin Index Page
 *
 * Placeholder shell shipped with US-BLOG-001 (foundation). Subsequent stories
 * replace this with the real admin shell (US-BLOG-007), Ideas/Briefs/Posts
 * pages, and analytics.
 *
 * Route: /platform-admin/blog (gated to platform admin via App.tsx
 * ProtectedRoute platformOnly).
 */
export default function BlogIndex() {
  useEffect(() => {
    document.title = 'Blog — Platform Admin · Printyx';
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog</h1>
          <Badge variant="secondary" className="text-xs">
            Foundation · US-BLOG-001
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Platform Admin blog system. Foundation directories and routes are in place; the full admin
          shell, content production pipeline, and autonomous publishing flow land in subsequent
          BLOG-### stories.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Schema</CardTitle>
            </div>
            <CardDescription className="text-xs">US-BLOG-002</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Drizzle tables for posts, briefs, keywords, distributions, and audit log. Tenant-scoped,
            RLS-enforced.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Admin Shell</CardTitle>
            </div>
            <CardDescription className="text-xs">US-BLOG-007</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Full sub-navigation: Ideas, Briefs, Posts, Distribution, Analytics, Refresh, Settings.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Autonomous Pipeline</CardTitle>
            </div>
            <CardDescription className="text-xs">US-BLOG-066, US-BLOG-086</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Auto-refresh agent re-edits posts on SERP decay. Global kill switch lands before the
            agent ships.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Implementation Status</CardTitle>
          <CardDescription>
            Foundation only. See <code>tasks/prd-address-book-manager.md</code> sibling and{' '}
            <code>blog-system-prd.json</code> for the full 86-story backlog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
            <li>
              Directories: <code>shared/blog/</code>, <code>supabase/functions/_shared/blog/</code>,{' '}
              <code>supabase/functions/blog/</code>,{' '}
              <code>client/src/pages/platform-admin/blog/</code>, <code>client/src/lib/blog/</code>
            </li>
            <li>
              Schema barrel: <code>shared/blog-schema.ts</code> (re-exported from{' '}
              <code>shared/schema.ts</code>)
            </li>
            <li>Sidebar entry: gated to platform admin role</li>
            <li>
              Placeholder route: <code>/platform-admin/blog</code>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
