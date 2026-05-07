import { FileText } from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSectionPlaceholder } from '@/components/blog/BlogSectionPlaceholder';

export default function BlogPosts() {
  return (
    <BlogShell title="Posts — Blog · Printyx">
      <BlogSectionPlaceholder
        title="Posts"
        description="The post entity and editor — drafting, version history, citations, SEO scoring, schema-markup planning, fact-checking, plagiarism / AI-content detection, and the multi-agent draft pipeline."
        icon={FileText}
        storyIds={[
          'US-BLOG-008',
          'US-BLOG-009',
          'US-BLOG-032',
          'US-BLOG-033',
          'US-BLOG-034',
          'US-BLOG-072',
        ]}
        capabilities={[
          'Rich-text editor with Markdown parity',
          'Version history with diff and restore',
          'AI draft generator with citations preserved inline',
          'Inline AI rewrite toolbar (shorter, longer, tone, simplify)',
          'SEO scoring engine with on-page checklist',
          'Pre-publish QA pass: links, mobile preview, OG cards, accessibility',
          'CMS publish flow via WordPress + Ghost adapters',
        ]}
      />
    </BlogShell>
  );
}
