import { Link } from 'wouter';
import {
  ClipboardList,
  FileText,
  Lightbulb,
  RefreshCcw,
  Settings as SettingsIcon,
  Share2,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogOnboardingChecklist } from '@/components/blog/BlogOnboardingChecklist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Blog Module — Dashboard (US-BLOG-007)
 *
 * Landing page at /platform-admin/blog. Renders inside BlogShell so it gets the
 * sub-nav strip. Acts as a directory of the seven sub-sections — replaces the
 * earlier US-BLOG-001 placeholder which described the module status.
 *
 * Future enhancement (US-BLOG-060 dashboard story): replace these directory
 * cards with summary widgets — recent posts, decay alerts, AI cost rollup,
 * upcoming distributions — pulled from the analytics service.
 */
export default function BlogIndex() {
  return (
    <BlogShell title="Blog — Platform Admin · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Dashboard</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Platform Admin Blog System overview. Use the sub-nav above to jump into a section, or
            press <kbd className="font-mono text-xs px-1 py-0.5 rounded border bg-muted">g i</kbd>{' '}
            for Ideas,{' '}
            <kbd className="font-mono text-xs px-1 py-0.5 rounded border bg-muted">g p</kbd> for
            Posts, etc.
          </p>
        </header>

        <BlogOnboardingChecklist />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionCard
            to="/platform-admin/blog/ideas"
            icon={Lightbulb}
            title="Ideas"
            description="Keyword research, SERP analysis, topic clustering"
          />
          <SectionCard
            to="/platform-admin/blog/briefs"
            icon={ClipboardList}
            title="Briefs"
            description="Content briefs feeding the AI draft pipeline"
          />
          <SectionCard
            to="/platform-admin/blog/posts"
            icon={FileText}
            title="Posts"
            description="Draft, edit, fact-check, publish via WordPress / Ghost"
          />
          <SectionCard
            to="/platform-admin/blog/distribution"
            icon={Share2}
            title="Distribution"
            description="Per-platform syndication: X, LinkedIn, newsletter, more"
          />
          <SectionCard
            to="/platform-admin/blog/analytics"
            icon={BarChart3}
            title="Analytics"
            description="GA4 + Search Console performance, A/B tests, AI costs"
          />
          <SectionCard
            to="/platform-admin/blog/refresh"
            icon={RefreshCcw}
            title="Refresh Queue"
            description="Auto-refresh decay candidates and review queue"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                  Agent Settings &amp; Kill Switch
                </CardTitle>
                <CardDescription>
                  Pause every blog agent in one click. Configure auto-refresh review gate.
                </CardDescription>
              </div>
              <Link
                to="/platform-admin/blog/settings"
                className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
              >
                Open Settings →
              </Link>
            </div>
          </CardHeader>
        </Card>
      </div>
    </BlogShell>
  );
}

interface SectionCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

function SectionCard({ to, icon: Icon, title, description }: SectionCardProps) {
  return (
    <Link to={to} className="group block" data-testid={`blog-card-${title.toLowerCase()}`}>
      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/30">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
