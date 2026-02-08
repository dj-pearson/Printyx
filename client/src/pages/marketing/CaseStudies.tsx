import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Printer,
  TrendingUp,
  Users,
  CheckCircle,
  ArrowRight,
  Building2,
  MapPin,
} from 'lucide-react';
import { GEOFaqSection } from '@/lib/seo/GEOFaqSection';

const caseStudyFaqs = [
  {
    question: 'What results do copier dealers see after switching to Printyx?',
    answer:
      'Copier dealers switching to Printyx see an average 30-40% reduction in emergency service calls, 15-25% increase in profitability, and payback within 4-7 months. For example, MidAtlantic Office Solutions saved $47,000 annually, while Pacific Print Services found $1.2M in additional annual profit through AI-powered contract optimization.',
  },
  {
    question: 'How long does it take to migrate from E-Automate to Printyx?',
    answer:
      'Migration from E-Automate to Printyx typically takes 6-8 weeks. This includes data migration (weeks 1-2), team training (weeks 3-4), workflow optimization (weeks 5-6), and full production rollout (weeks 7-8). Southern Business Systems completed their migration in 6 weeks with zero data loss and reported 45 minutes saved per technician per day.',
  },
  {
    question: 'What is the ROI of switching to Printyx from legacy dealer management software?',
    answer:
      'Dealers achieve payback in 4-7 months. ROI sources include emergency call reduction (30-40%), contract repricing from AI analysis (15-25% margin improvement), and efficiency gains from mobile-first tools. One dealer identified 147 underpriced contracts at renewal and generated $1.2M in additional annual profit.',
  },
  {
    question: 'Do field technicians like using Printyx mobile app?',
    answer:
      'Yes, technicians rate the Printyx mobile app 4.8 out of 5. The offline-first design works without connectivity, training takes 2-3 hours versus days for legacy systems, and 90%+ of technicians report satisfaction. Southern Business Systems reported 92% technician satisfaction after switching from E-Automate.',
  },
];

const CaseStudies = () => {
  const caseStudies = [
    {
      company: 'MidAtlantic Office Solutions',
      location: 'Virginia',
      size: '15 technicians, 500 contracts',
      industry: 'Multi-brand Dealer',
      challenge:
        'High emergency call volume eating into profitability, manual meter billing taking 3 days per month',
      solution: 'Implemented Printyx predictive maintenance and automated billing',
      results: [
        { metric: '38% reduction', description: 'in emergency service calls' },
        { metric: '$47,000', description: 'annual service cost savings' },
        { metric: '3.8 → 4.4', description: 'customer satisfaction score (out of 5)' },
        { metric: '82% → 91%', description: 'contract renewal rate' },
      ],
      quote:
        "Printyx's predictive maintenance has transformed our service operations. We're preventing problems instead of reacting to them, and our customers notice the difference.",
      author: 'Sarah Johnson',
      title: 'VP of Operations',
      color: 'blue',
    },
    {
      company: 'Pacific Print Services',
      location: 'California',
      size: '40 technicians, 1,200 contracts',
      industry: 'Canon Authorized Dealer',
      challenge:
        'Underpriced contracts losing money, no visibility into per-contract profitability',
      solution: 'Deployed AI-powered dynamic pricing and contract profitability analytics',
      results: [
        { metric: '$1.2M', description: 'additional annual profit' },
        { metric: '23% increase', description: 'in average contract margins' },
        { metric: '147 contracts', description: 'repriced at renewal' },
        { metric: '6 months', description: 'payback period' },
      ],
      quote:
        'We had no idea how many contracts were underwater until Printyx showed us. The dynamic pricing recommendations have been a game-changer for our bottom line.',
      author: 'Michael Chen',
      title: 'CFO',
      color: 'purple',
    },
    {
      company: 'Southern Business Systems',
      location: 'Georgia',
      size: '8 technicians, 300 contracts',
      industry: 'Regional Dealer',
      challenge:
        'Legacy e-automate system limiting growth, technicians struggling with clunky mobile app',
      solution: 'Migrated to Printyx modern cloud platform with offline-first mobile',
      results: [
        { metric: '6 weeks', description: 'complete migration timeline' },
        { metric: 'Zero', description: 'data loss during migration' },
        { metric: '45 minutes', description: 'average daily time saved per tech' },
        { metric: '92%', description: 'technician satisfaction with mobile app' },
      ],
      quote:
        'The migration from e-automate was smoother than we expected. Within a month, our technicians were more productive and happier with the tools. We should have done this years ago.',
      author: 'David Martinez',
      title: 'Owner',
      color: 'green',
    },
  ];

  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Customer Success Stories - Printyx Case Studies',
          description:
            "See how copier dealers increased profitability 15-25%, reduced emergency calls 30-40%, and improved customer satisfaction with Printyx's predictive intelligence platform.",
          url: 'https://printyx.net/case-studies',
        })}
      </script>

      <div className="min-h-screen bg-white">
        {/* Header */}
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
                <Button
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                  onClick={() => (window.location.href = '/signup')}
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge className="mb-6 bg-white/20 text-white border-white/30 text-base px-4 py-2 backdrop-blur-sm">
                Customer Success Stories
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Real Dealers.
                <br />
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  Real Results.
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
                See how copier dealers are transforming their operations with predictive
                intelligence, modern architecture, and AI-powered automation.
              </p>
            </div>
          </div>
        </section>

        {/* Results Overview */}
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Average Results Across Dealers
              </h2>
              <p className="text-gray-600">Conservative estimates from actual implementations</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-2 border-green-200 bg-green-50/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">30-40%</div>
                  <div className="text-gray-700 font-medium">Emergency Call Reduction</div>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">15-25%</div>
                  <div className="text-gray-700 font-medium">Profitability Increase</div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 bg-purple-50/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">6-8 weeks</div>
                  <div className="text-gray-700 font-medium">Migration Timeline</div>
                </CardContent>
              </Card>

              <Card className="border-2 border-orange-200 bg-orange-50/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">4-7 months</div>
                  <div className="text-gray-700 font-medium">Payback Period</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12">
              {caseStudies.map((study, index) => (
                <Card key={index} className={`border-2 border-${study.color}-200 overflow-hidden`}>
                  <div
                    className={`bg-gradient-to-r from-${study.color}-50 to-${study.color}-100 p-6 border-b-2 border-${study.color}-200`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center mb-2">
                          <Building2 className={`h-6 w-6 text-${study.color}-600 mr-2`} />
                          <h3 className="text-2xl font-bold text-gray-900">{study.company}</h3>
                        </div>
                        <div className="flex items-center text-gray-700">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="mr-4">{study.location}</span>
                          <Users className="h-4 w-4 mr-1" />
                          <span>{study.size}</span>
                        </div>
                      </div>
                      <Badge className={`mt-3 md:mt-0 bg-${study.color}-600 text-white`}>
                        {study.industry}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Left Column: Challenge & Solution */}
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 text-lg">The Challenge</h4>
                          <p className="text-gray-700">{study.challenge}</p>
                        </div>

                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 text-lg">The Solution</h4>
                          <p className="text-gray-700">{study.solution}</p>
                        </div>

                        <div
                          className={`bg-${study.color}-50 p-6 rounded-xl border-2 border-${study.color}-200`}
                        >
                          <p className="text-gray-800 italic mb-4">"{study.quote}"</p>
                          <div className="text-sm">
                            <div className="font-bold text-gray-900">{study.author}</div>
                            <div className="text-gray-600">{study.title}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Results */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4 text-lg">The Results</h4>
                        <div className="space-y-4">
                          {study.results.map((result, resultIndex) => (
                            <div
                              key={resultIndex}
                              className="flex items-start p-4 bg-gray-50 rounded-lg border-2 border-gray-200"
                            >
                              <CheckCircle
                                className={`h-6 w-6 text-${study.color}-600 mr-3 flex-shrink-0 mt-0.5`}
                              />
                              <div>
                                <div className={`text-2xl font-bold text-${study.color}-600 mb-1`}>
                                  {result.metric}
                                </div>
                                <div className="text-gray-700">{result.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Common Themes */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Common Success Patterns</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                What these dealers have in common
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">Fast Implementation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Most dealers are fully operational within 6-8 weeks, including data migration,
                    team training, and workflow optimization.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                      <span>Week 1-2: Data migration</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                      <span>Week 3-4: Team training</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                      <span>Week 5-6: Workflow optimization</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                      <span>Week 7-8: Full production</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">Quick ROI</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Dealers typically see payback within 4-7 months through service cost reduction,
                    improved contract profitability, and efficiency gains.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Month 1: Immediate efficiency gains</span>
                    </li>
                    <li className="flex items-start">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Month 2-3: Emergency call reduction</span>
                    </li>
                    <li className="flex items-start">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Month 4-6: Contract repricing impact</span>
                    </li>
                    <li className="flex items-start">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Month 6+: Full ROI realized</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">Team Adoption</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    High adoption rates across all roles, especially field technicians who love the
                    offline-first mobile app and intuitive workflows.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <Users className="h-4 w-4 text-purple-600 mr-2 mt-0.5" />
                      <span>90%+ technician satisfaction</span>
                    </li>
                    <li className="flex items-start">
                      <Users className="h-4 w-4 text-purple-600 mr-2 mt-0.5" />
                      <span>Reduced training time vs. legacy</span>
                    </li>
                    <li className="flex items-start">
                      <Users className="h-4 w-4 text-purple-600 mr-2 mt-0.5" />
                      <span>Mobile app rated 4.8/5 by users</span>
                    </li>
                    <li className="flex items-start">
                      <Users className="h-4 w-4 text-purple-600 mr-2 mt-0.5" />
                      <span>Modern UI increases productivity</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section for GEO/SEO */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <GEOFaqSection
              faqs={caseStudyFaqs}
              title="Common Questions About Switching to Printyx"
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Write Your Success Story?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join these dealers and start seeing results in weeks, not months. Try Printyx free for
              14 days.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-10 py-7"
                onClick={() => (window.location.href = '/signup')}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 py-7 border-2 border-white text-white hover:bg-white hover:text-blue-600"
                onClick={() => (window.location.href = '/roi-calculator')}
              >
                Calculate Your ROI
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <Printer className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">Printyx</span>
              </div>
              <div className="text-center md:text-right">
                <p className="text-gray-400">© 2025 Printyx. All rights reserved.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Case Studies • Customer Success • ROI Calculator
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default CaseStudies;
