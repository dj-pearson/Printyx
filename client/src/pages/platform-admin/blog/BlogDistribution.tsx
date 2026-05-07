import { Share2 } from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSectionPlaceholder } from '@/components/blog/BlogSectionPlaceholder';

export default function BlogDistribution() {
  return (
    <BlogShell title="Distribution — Blog · Printyx">
      <BlogSectionPlaceholder
        title="Distribution"
        description="Per-platform syndication: every post becomes an X thread, LinkedIn long-form, email newsletter, etc. Configures destination targets and schedules variant publication."
        icon={Share2}
        storyIds={['US-BLOG-043', 'US-BLOG-044', 'US-BLOG-053', 'US-BLOG-054', 'US-BLOG-055']}
        capabilities={[
          'X / Twitter thread generator',
          'LinkedIn long-form post generator',
          'Email newsletter generator from post',
          'Auto-scheduling with optimal-time prediction per audience',
          'UTM strategy and per-channel link tracking',
          'Re-share cadence engine',
          'Internal-link auto-injection on publish',
        ]}
      />
    </BlogShell>
  );
}
