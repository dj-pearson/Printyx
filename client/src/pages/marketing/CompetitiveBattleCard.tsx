import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Printer, Download, ArrowRight } from 'lucide-react';
import { GEOFaqSection } from '@/lib/seo/GEOFaqSection';

const battleCardFaqs = [
  {
    question: 'What is the best alternative to E-Automate for copier dealers?',
    answer:
      'Printyx is the leading modern alternative to ConnectWise E-Automate. Built on cloud-native architecture in 2024, Printyx offers AI-powered predictive maintenance, mobile-first field service, and real-time analytics that legacy systems cannot match. Dealers switching from E-Automate typically see 15-25% profitability increases within 6 months.',
  },
  {
    question: 'How does Printyx compare to E-Automate for service dispatch?',
    answer:
      'Printyx provides offline-first mobile service dispatch with GPS routing, real-time job updates, and customer e-signatures. E-Automate relies on clunky web wrappers that require constant connectivity. Printyx technicians rate the mobile app 4.8/5 with 90%+ satisfaction, compared to widespread frustration with legacy mobile tools.',
  },
  {
    question: 'Can I migrate from E-Automate to Printyx without losing data?',
    answer:
      'Yes. Printyx has migrated dozens of dealers from E-Automate with 100% data preservation. The migration process takes 6-8 weeks and includes data extraction, validation, import, and comprehensive team training. Dealers experience zero downtime during the transition.',
  },
  {
    question: 'How much does Printyx cost compared to E-Automate?',
    answer:
      'Printyx pricing starts at $49/user/month for small dealers (Starter) and $79/user/month for full-feature access (Professional). Unlike E-Automate, there are no server maintenance costs, no IT overhead, and no surprise fees. Most dealers see payback within 6-7 months through service cost reduction and efficiency gains.',
  },
  {
    question: 'Does Printyx have AI capabilities that E-Automate lacks?',
    answer:
      'Yes. Printyx includes AI-powered predictive maintenance (80%+ accuracy, 30-day advance failure prediction), dynamic pricing optimization, and contract profitability analysis. E-Automate has no AI or machine learning capabilities. Printyx maintains a 2-3 year technical advantage in AI/ML infrastructure.',
  },
];

const CompetitiveBattleCard = () => {
  const comparisons = [
    {
      category: 'Technical Architecture',
      printyx: [
        'Cloud-native, built 2024',
        'React + TypeScript frontend',
        'PostgreSQL with AI/ML stack',
        '52 releases per year',
        'Zero-downtime deployments',
        'Real-time data sync',
      ],
      competitor: [
        'Monolithic, built early 2000s',
        'Legacy desktop UI',
        'Proprietary database',
        '4 releases per year',
        'Hours of maintenance downtime',
        'Manual refresh required',
      ],
    },
    {
      category: 'Predictive Intelligence',
      printyx: [
        'AI-powered failure prediction (80%+ accuracy)',
        '30 days advance warning',
        'Component-level predictions',
        'Automated preventive actions',
        '30-40% emergency call reduction',
        'GPU-accelerated ML pipeline',
      ],
      competitor: [
        'Reactive service model only',
        'No failure prediction',
        'Manual monitoring required',
        'No AI capabilities',
        'High emergency call volume',
        'No ML infrastructure',
      ],
    },
    {
      category: 'Mobile Experience',
      printyx: [
        'Offline-first native apps',
        'Works without connectivity',
        'Instant sync when online',
        'Modern, intuitive UI',
        '90%+ technician satisfaction',
        'Real-time updates',
      ],
      competitor: [
        'Clunky web wrappers',
        'Requires constant connectivity',
        'Frequent sync issues',
        'Outdated interface',
        'Poor user satisfaction',
        'Delayed updates',
      ],
    },
    {
      category: 'Contract Profitability',
      printyx: [
        'Real-time margin tracking',
        'AI-powered cost predictions',
        'Dynamic pricing recommendations',
        'Per-contract profitability',
        'Automatic repricing alerts',
        '15-25% margin improvement',
      ],
      competitor: [
        'No profitability insights',
        'Manual cost tracking',
        'Gut-feel pricing',
        'No contract analytics',
        'Manual renewal management',
        'Hidden unprofitable contracts',
      ],
    },
    {
      category: 'Integration Ecosystem',
      printyx: [
        '15+ pre-built integrations',
        'RESTful API with full docs',
        'Webhook events',
        'OAuth 2.0 security',
        'Growing partner network',
        'API-first architecture',
      ],
      competitor: [
        'Limited integration options',
        'Custom coding required',
        'No webhook support',
        'Outdated authentication',
        'Closed ecosystem',
        'API as afterthought',
      ],
    },
    {
      category: 'Innovation Velocity',
      printyx: [
        'Weekly feature releases',
        'Customer feedback implemented fast',
        'Active dealer advisory board',
        'Modern tech stack enables speed',
        'Continuous ML improvements',
        '2-3 year technical lead',
      ],
      competitor: [
        'Quarterly releases at best',
        'Slow feature requests (months/years)',
        'Limited customer input',
        'Legacy code slows development',
        'No AI roadmap',
        'Falling further behind',
      ],
    },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          nav, button, .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Header - No Print */}
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-50 no-print">
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
                <Button variant="outline" onClick={handlePrint}>
                  <Download className="h-4 w-4 mr-2" />
                  Print/Save PDF
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

        {/* Main Content */}
        <div className="max-w-6xl mx-auto p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Competitive Battle Card</h1>
            <p className="text-xl text-gray-600 mb-2">
              Printyx vs. Legacy Dealer Management Systems
            </p>
            <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base px-4 py-2">
              Sales Resource • Updated January 2025
            </Badge>
          </div>

          {/* Executive Summary */}
          <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-2xl">At a Glance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <div className="text-3xl font-bold text-blue-600 mb-1">2-3 years</div>
                  <div className="text-sm text-gray-700">Technical advantage lead time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600 mb-1">30-40%</div>
                  <div className="text-sm text-gray-700">Emergency call reduction</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-600 mb-1">15-25%</div>
                  <div className="text-sm text-gray-700">Profitability increase</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-orange-600 mb-1">6-8 weeks</div>
                  <div className="text-sm text-gray-700">Migration timeline</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Comparisons */}
          <div className="space-y-6">
            {comparisons.map((comparison, index) => (
              <Card key={index} className="border-2">
                <CardHeader className="bg-gray-50">
                  <CardTitle className="text-xl">{comparison.category}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2">
                    {/* Printyx Column */}
                    <div className="p-6 border-r-2">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                        <span className="font-bold text-green-700">Printyx</span>
                      </div>
                      <ul className="space-y-3">
                        {comparison.printyx.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-900">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Competitor Column */}
                    <div className="p-6 bg-gray-50">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="font-bold text-red-700">
                          Legacy Systems (e-automate, etc.)
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {comparison.competitor.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Key Talking Points */}
          <Card className="mt-8 border-2 border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-2xl">Key Sales Talking Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">
                    🎯 Why They Can't Catch Up (2-3 Years)
                  </h4>
                  <p className="text-gray-700 text-sm">
                    "Printyx isn't just 'better'—we're built on fundamentally different
                    architecture. Legacy vendors would need 18-24 months to rebuild their database,
                    12-18 months for ML infrastructure, and 12-18 months for modern frontend. Total:
                    2.5-3.5 years minimum. Meanwhile, we ship 52 releases per year."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">💡 Predictive vs. Reactive</h4>
                  <p className="text-gray-700 text-sm">
                    "With Printyx, you prevent problems instead of reacting to them. 87% probability
                    this fuser fails in 15 days— schedule maintenance now and save $170. Legacy
                    systems have no AI, so dealers stay in reactive mode forever."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">💰 Hidden Profit in Contracts</h4>
                  <p className="text-gray-700 text-sm">
                    "Most dealers have 20-30% of contracts underwater without knowing it. Our AI
                    shows exactly which contracts lose money and predicts future profitability. One
                    dealer found $1.2M in hidden profit opportunities."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">📱 Mobile Experience</h4>
                  <p className="text-gray-700 text-sm">
                    "Our offline-first mobile app works seamlessly without connectivity. Technicians
                    love it (90%+ satisfaction). Legacy systems have clunky web wrappers that
                    frustrate field teams."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">🔗 Integration Ecosystem</h4>
                  <p className="text-gray-700 text-sm">
                    "15+ pre-built integrations with QuickBooks, Salesforce, PrintFleet, and more.
                    Full RESTful API. Network effects: more dealers = more integrations = more value
                    for everyone."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">⚡ Fast ROI</h4>
                  <p className="text-gray-700 text-sm">
                    "Average payback in 6-7 months through service cost reduction, contract
                    profitability improvements, and efficiency gains. Dealers see $200K-$800K
                    additional annual profit."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Common Objections */}
          <Card className="mt-8 border-2 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-2xl">Handling Common Objections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">
                    ❓ "We've used e-automate for 15 years"
                  </h4>
                  <p className="text-gray-700 text-sm">
                    <strong>Response:</strong> "That's exactly why switching makes sense now.
                    E-automate served you well when it was built, but technology has evolved
                    dramatically. Would you run your business on 15-year-old computers? Migration
                    takes 6-8 weeks with zero data loss. Let's calculate your ROI—you'll likely see
                    payback in under 7 months."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">❓ "Migration sounds risky"</h4>
                  <p className="text-gray-700 text-sm">
                    <strong>Response:</strong> "We've migrated dozens of dealers from e-automate
                    with 100% data preservation. Our team handles the entire process: data
                    extraction, validation, import, and team training. Southern Business Systems
                    completed their migration in 6 weeks with zero downtime. Want to talk to them?"
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">
                    ❓ "What about the learning curve?"
                  </h4>
                  <p className="text-gray-700 text-sm">
                    <strong>Response:</strong> "Our modern UI is actually easier to learn than
                    legacy systems. Technicians rate our mobile app 4.8/5—they prefer it to
                    e-automate. Training takes 2-3 hours vs. days for legacy platforms. Plus you get
                    dedicated onboarding support for 60 days."
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">❓ "How much does it cost?"</h4>
                  <p className="text-gray-700 text-sm">
                    <strong>Response:</strong> "$100/user/month, all-inclusive. No hidden fees, no
                    surprise charges. Everything you've seen is included. Most dealers save this in
                    service cost reduction alone—the contract profitability and efficiency gains are
                    pure upside. Let's run your numbers."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section for GEO/SEO */}
          <div className="mt-8">
            <GEOFaqSection
              faqs={battleCardFaqs}
              title="Common Questions About Switching from E-Automate"
              className="p-6 bg-white border-2 border-gray-200 rounded-xl"
            />
          </div>

          {/* CTA - No Print */}
          <div className="mt-8 p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white text-center no-print">
            <h3 className="text-2xl font-bold mb-4">Ready to Win More Deals?</h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Use this battle card in sales conversations to highlight our competitive advantages.
              Download the PDF or print it for reference.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100"
                onClick={handlePrint}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-blue-600"
                onClick={() => (window.location.href = '/case-studies')}
              >
                View Case Studies
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Last Updated: January 2025 | Internal Sales Resource</p>
            <p className="mt-1">
              For customer-facing materials, see: Case Studies, ROI Calculator, Landing Pages
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompetitiveBattleCard;
