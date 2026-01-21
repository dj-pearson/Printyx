import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  ArrowRight,
  Award,
  Target,
  Users,
  Zap,
  TrendingUp,
  BookOpen,
  Printer,
} from 'lucide-react';

const DealerExpertise = () => {
  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Dealer Expertise - Built by Dealers, for Dealers',
          description:
            'Printyx is built on deep copier dealer domain expertise. Every workflow, metric, and feature designed by people who understand your business inside-out. Defensible through superior execution.',
          url: 'https://printyx.com/dealer-expertise',
          mainEntity: {
            '@type': 'SoftwareApplication',
            name: 'Printyx',
            applicationCategory: 'BusinessApplication',
          },
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
                Domain Expertise Advantage
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Built by Dealers.
                <br />
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  For Dealers.
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed mb-8">
                Generic business software doesn't understand copier dealerships. Printyx is designed
                by people who've run dealer operations—every workflow, metric, and feature reflects
                deep industry expertise.
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
                  onClick={() => (window.location.href = '/login')}
                >
                  Schedule Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem with Generic Software */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why Generic Software Falls Short
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Copier dealerships have unique workflows that generic CRMs and ERPs don't understand
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="border-2 border-red-200 bg-red-50/30">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900">Generic Business Software</CardTitle>
                  <CardDescription>One-size-fits-none approach</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <span>Meter billing as a custom field hack</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <span>Service contracts forced into sales opportunities</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <span>Equipment lifecycle tracking with workarounds</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <span>No understanding of dealer-specific metrics</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <span>Technician workflow doesn't fit service ticket model</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-300 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900">Printyx Dealer Platform</CardTitle>
                  <CardDescription>Purpose-built for your industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <span>Native meter billing with automated invoicing</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <span>Service contracts as first-class entities</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <span>Equipment from cradle to grave tracking</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <span>Dealer KPIs: pages/tech, cost/click, contract profitability</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <span>Mobile app designed for field service reality</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Dealer-Specific Features */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Features Only Dealers Would Design
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Every detail reflects real-world dealer operations
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 hover:border-blue-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Contract Profitability Analysis
                  </h3>
                  <p className="text-gray-600">
                    Real-time profitability tracking per contract. Factors in equipment cost,
                    service history, supplies, and technician time. Know which contracts make money.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-purple-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Meter Billing Automation</h3>
                  <p className="text-gray-600">
                    Automated meter collection, overage calculations, invoice generation, and
                    payment tracking. Handles base allowances, tiered pricing, color vs. mono,
                    everything.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-green-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Technician Productivity Metrics
                  </h3>
                  <p className="text-gray-600">
                    Track pages serviced per tech, first-time fix rates, average service time, parts
                    usage efficiency. Metrics that actually matter for service operations.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-orange-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Equipment Lifecycle Management
                  </h3>
                  <p className="text-gray-600">
                    From quote to installation to service to replacement. Track warranty status,
                    service costs, meter progression, and optimal replacement timing.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-red-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Dealer-Specific Dashboards
                  </h3>
                  <p className="text-gray-600">
                    KPIs dealers actually use: pages per technician, cost per click, contract
                    renewal rates, equipment placement ROI, service response times.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-indigo-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Supplies Chain Management
                  </h3>
                  <p className="text-gray-600">
                    Automated toner ordering based on predicted usage. Track supplies by device,
                    customer alerts before stockouts, vendor management, margin tracking.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Understanding the Business */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">We Speak Your Language</h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                Built by people who understand the dealer business inside-out
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="bg-white/10 backdrop-blur-sm border-2 border-white/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4">We Know Your Pain Points</h3>
                  <ul className="space-y-3 text-blue-100">
                    <li>• Emergency calls disrupting planned routes</li>
                    <li>• Meter collection delays killing cash flow</li>
                    <li>• Underpriced contracts bleeding profit</li>
                    <li>• Service contract renewals falling through cracks</li>
                    <li>• Equipment cost vs. service cost imbalance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-2 border-white/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4">We Know Your Workflow</h3>
                  <ul className="space-y-3 text-blue-100">
                    <li>• Lead → Quote → Demo → Install → Service</li>
                    <li>• Monthly meter reads → Invoice generation</li>
                    <li>• Service call → Parts order → Follow-up</li>
                    <li>• Contract expiry → Renewal negotiation</li>
                    <li>• Equipment swap → Old device disposal</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-2 border-white/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4">We Know Your Metrics</h3>
                  <ul className="space-y-3 text-blue-100">
                    <li>• Pages serviced per technician</li>
                    <li>• Cost per click (actual, not quoted)</li>
                    <li>• Contract gross margin</li>
                    <li>• First-time fix rate</li>
                    <li>• Equipment placement ROI</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Continuous Learning */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Defensible Through Execution
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Domain expertise isn't static—it compounds through continuous dealer feedback
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-xl">Active Dealer Advisory Board</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Monthly sessions with dealers across the country. Direct input on feature
                    priorities, workflow design, and pain points we should address.
                  </p>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 font-semibold mb-2">Recent Impacts:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Redesigned service dispatch UI based on tech feedback</li>
                      <li>• Added contract profitability alerts</li>
                      <li>• Built automated renewal workflow</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-300">
                <CardHeader>
                  <CardTitle className="text-xl">Data-Driven Feature Development</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    We analyze how dealers actually use the platform. Feature usage, workflow
                    patterns, pain points—all inform our roadmap.
                  </p>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 font-semibold mb-2">Our Process:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Usage analytics from real dealer workflows</li>
                      <li>• Monthly dealer interviews</li>
                      <li>• Feature request voting system</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-8 max-w-4xl mx-auto border-2 border-green-300 bg-green-50">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Why Generic Software Can't Catch Up
                </h3>
                <p className="text-gray-700 mb-4">
                  Horizontal SaaS platforms serve thousands of industries. They can't invest the
                  engineering resources to deeply understand copier dealerships. We do nothing else.
                </p>
                <p className="text-gray-700">
                  Every feature, every workflow, every metric—optimized for your business. That
                  depth of expertise takes years to build and can't be copied by a company spread
                  across 50 industries.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Finally, Software That Gets It
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Stop fighting with generic software. Use a platform designed by dealers who understand
              every nuance of your business.
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
                onClick={() => (window.location.href = '/login')}
              >
                Schedule Demo
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
                  Dealer Expertise • Predictive Intelligence • Modern Architecture
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default DealerExpertise;
