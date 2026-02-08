/**
 * GEO-Optimized FAQ Section Component
 * Renders FAQ content with embedded JSON-LD FAQPage schema for both
 * traditional SEO and AI search engine citation optimization.
 *
 * Follows GEO best practices:
 * - Question-phrased headings for natural language queries
 * - Direct answers in first 40-60 words per answer
 * - Structured data for AI extraction
 * - Q&A pairs under 300 characters for citation snippets
 */

import React from 'react';

export interface FAQItem {
  question: string;
  answer: string;
}

interface GEOFaqSectionProps {
  faqs: FAQItem[];
  title?: string;
  className?: string;
}

/**
 * GEO-optimized FAQ section with embedded schema markup.
 * Use on marketing and landing pages to improve AI citation potential.
 */
export function GEOFaqSection({
  faqs,
  title = 'Frequently Asked Questions',
  className = '',
}: GEOFaqSectionProps) {
  if (faqs.length === 0) return null;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section className={`geo-faq-section ${className}`} aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h2 id="faq-heading" className="text-2xl font-bold mb-6">
        {title}
      </h2>
      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
            <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default GEOFaqSection;
