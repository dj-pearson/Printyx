import { Lightbulb } from 'lucide-react';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSectionPlaceholder } from '@/components/blog/BlogSectionPlaceholder';

export default function BlogIdeas() {
  return (
    <BlogShell title="Ideas — Blog · Printyx">
      <BlogSectionPlaceholder
        title="Ideas"
        description="Keyword research, SERP analysis, People-Also-Ask mining, content-gap discovery, and topic clustering — the discovery surface that feeds the editorial pipeline."
        icon={Lightbulb}
        storyIds={['US-BLOG-013', 'US-BLOG-014', 'US-BLOG-015', 'US-BLOG-016', 'US-BLOG-019']}
        capabilities={[
          'Keyword research adapter (DataForSEO in v1)',
          'Search-intent classifier',
          'SERP analyzer + People-Also-Ask + autocomplete miners',
          'Forum / community question miner (Reddit, Quora, Stack Exchange)',
          'Competitor content-gap analysis',
          'Topic clustering with pillar / cluster model',
        ]}
      />
    </BlogShell>
  );
}
