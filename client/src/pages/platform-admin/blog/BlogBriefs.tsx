import { ClipboardList } from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSectionPlaceholder } from '@/components/blog/BlogSectionPlaceholder';

export default function BlogBriefs() {
  return (
    <BlogShell title="Briefs — Blog · Printyx">
      <BlogSectionPlaceholder
        title="Briefs"
        description="Content briefs feeding the AI draft pipeline. One brief per planned post, with target keyword, audience, search intent, recommended outline, key takeaways, and SERP snapshot."
        icon={ClipboardList}
        storyIds={['US-BLOG-023', 'US-BLOG-024', 'US-BLOG-031']}
        capabilities={[
          'Auto-brief generator from keyword + SERP',
          'Editorial calendar with assignments and deadlines',
          'Outline A/B variations scored against SERP',
          'Brief status workflow: draft → ready → in_progress → complete',
        ]}
      />
    </BlogShell>
  );
}
