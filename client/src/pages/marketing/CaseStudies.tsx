/**
 * Customer stories page.
 *
 * LEGAL-002: this page previously carried three fabricated case studies -
 * named dealers (MidAtlantic Office Solutions, Pacific Print Services,
 * Southern Business Systems), named executives with first-person quotes, and
 * specific financial outcomes ($47,000 saved, $1.2M additional profit, 92%
 * technician satisfaction) - none of which came from a real customer. It also
 * presented invented aggregate figures as "conservative estimates from actual
 * implementations".
 *
 * The route is kept because sibling pages and the SEO config link to it, but
 * the content now says plainly that there is nothing published yet. When real
 * customers agree to be named, add them here with written permission on file
 * and record the substantiation in docs/marketing-claims-substantiation.md.
 *
 * Do not reintroduce illustrative or composite customers on this page. A
 * modeled number belongs in the ROI calculator, where the visitor supplies the
 * inputs and can see it is a projection.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';
import { GEOFaqSection } from '@/lib/seo/GEOFaqSection';

const caseStudyFaqs = [
  {
    question: 'Does Printyx publish customer case studies?',
    answer:
      'Not yet. Printyx is early, and we would rather tell you that than publish numbers we cannot stand behind. When dealers agree to be named and share measured results, their stories will appear on this page with the figures attributed to them.',
  },
  {
    question: 'How can I evaluate Printyx without published customer results?',
    answer:
      'Run your own numbers in the ROI calculator, which projects outcomes from inputs you supply rather than from other dealers we cannot show you, and start a free trial against your own data. Both tell you more about your operation than a case study about someone else would.',
  },
  {
    question: 'What does migrating from E-Automate involve?',
    answer:
      'Data extraction and mapping, validation against your existing records, import, and team training. How long that takes depends on how much history you carry, how clean it is, and how many people need training, so we scope it per dealer instead of quoting a standard timeline.',
  },
  {
    question: 'Can I speak with an existing Printyx dealer?',
    answer:
      'Ask us. Whether a reference call is available depends on which dealers have agreed to take them, and we will tell you straight if none is available for your segment yet.',
  },
];

const CaseStudies = () => {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Customer Stories - Printyx',
          description:
            'Printyx has no published customer case studies yet. Evaluate the platform with the ROI calculator and a free trial against your own data.',
          url: 'https://printyx.net/case-studies',
        })}
      </script>

      <div className="min-h-screen bg-white">
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  onClick={() => (window.location.href = '/')}
                  className="hover:bg-gray-100"
                >
                  <Printer className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">Printyx</span>
                </Button>
              </div>
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={() => (window.location.href = '/login')}>
                  Login
                </Button>
                <Button onClick={() => (window.location.href = '/signup')}>Start Free Trial</Button>
              </div>
            </div>
          </div>
        </nav>

        <section className="border-b border-gray-200 py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Customer stories</h1>
            <p className="text-xl text-gray-700 leading-relaxed">We have not published any yet.</p>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Printyx is early. Plenty of software in this category fills a page like this with
              stock photography and numbers nobody can check, and we would rather leave it empty
              until we have dealers willing to put their name to a result. When that happens, their
              figures will appear here attributed to them.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              What to do instead of reading someone else&apos;s numbers
            </h2>
            <p className="text-gray-700 leading-relaxed mb-8">
              A case study tells you what happened at a dealer whose contract mix, technician count
              and service history are not yours. These two tell you about your own operation.
            </p>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Run the ROI calculator</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    It projects savings from figures you enter: your machine count, your service
                    call volume, your contract values. The output is a model of your inputs, not a
                    measurement of anyone&apos;s results, and it shows its working.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => (window.location.href = '/roi-calculator')}
                  >
                    Open the calculator
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Start a trial with your own data
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Fourteen days, no payment method required to begin. Import a slice of your
                    contracts and service history and judge the platform on how it handles them.
                  </p>
                  <Button onClick={() => (window.location.href = '/signup')}>
                    Start free trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <GEOFaqSection faqs={caseStudyFaqs} title="Questions about evaluating Printyx" />
          </div>
        </section>

        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <Printer className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">Printyx</span>
              </div>
              <p className="text-gray-400">&copy; 2025 Printyx. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default CaseStudies;
