import { RefreshCcw } from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSectionPlaceholder } from '@/components/blog/BlogSectionPlaceholder';

export default function BlogRefresh() {
  return (
    <BlogShell title="Refresh — Blog · Printyx">
      <BlogSectionPlaceholder
        title="Refresh Queue"
        description="Auto-flagged decay candidates and the queue feeding the auto-refresh agent. Review queue surfaces edits flagged by the hard guardrails (change-magnitude, SEO regression, voice / style violations)."
        icon={RefreshCcw}
        storyIds={['US-BLOG-061', 'US-BLOG-066', 'US-BLOG-021']}
        capabilities={[
          'Content-decay detector (per-post and per-cluster)',
          'Content refresh queue with auto-flagged decay candidates',
          'Auto-refresh agent: SERP diff → revision → re-publish',
          'Review queue for guardrail-flagged edits',
          'Per-action revert (restores prior revision, re-publishes)',
        ]}
      />
    </BlogShell>
  );
}
