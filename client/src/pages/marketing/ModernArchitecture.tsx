import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  Cloud,
  Database,
  Code,
  Zap,
  Shield,
  Smartphone,
  Printer,
} from 'lucide-react';

const ModernArchitecture = () => {
  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Modern Cloud Architecture - Built for 2025, Not 2005',
          description:
            "Printyx's modern cloud-native architecture delivers a 2-3 year technical advantage over legacy dealer management systems. Real-time updates, offline-first mobile, AI/ML infrastructure, and 99.9% uptime.",
          url: 'https://printyx.net/modern-architecture',
          mainEntity: {
            '@type': 'SoftwareApplication',
            name: 'Printyx Platform',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Cloud',
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
                2-3 Year Technical Advantage
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Built for 2025,
                <br />
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  Not 2005.
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed mb-8">
                Legacy dealer management systems were designed when mobile apps didn't exist and AI
                was science fiction. Printyx is built on modern cloud-native architecture that gives
                you capabilities competitors can't match for years.
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
                  onClick={() =>
                    (window.location.href = '/blog/e-automate-vs-modern-cloud-platforms')
                  }
                >
                  Read Architecture Comparison
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Legacy vs Modern Comparison */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Legacy vs. Modern: The Technical Reality
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                This isn't about features. It's about fundamental architecture that determines
                what's possible.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2 border-red-200 bg-red-50/30">
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <Database className="h-8 w-8 text-red-600 mr-3" />
                    <CardTitle className="text-2xl">Legacy Architecture</CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    Systems designed in the early 2000s
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Monolithic design</strong>
                        <p className="text-gray-600 text-sm">
                          Single codebase making updates risky and slow
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">On-premise servers</strong>
                        <p className="text-gray-600 text-sm">
                          Requires IT staff, hardware maintenance, backup systems
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Desktop-first UI</strong>
                        <p className="text-gray-600 text-sm">
                          Mobile apps are awkward retrofits, not native experiences
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Proprietary databases</strong>
                        <p className="text-gray-600 text-sm">
                          Can't support modern AI/ML workloads
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Quarterly updates</strong>
                        <p className="text-gray-600 text-sm">
                          4 releases per year, long deployment processes
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Limited integrations</strong>
                        <p className="text-gray-600 text-sm">
                          Custom coding required for each connection
                        </p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-300 bg-green-50/30">
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <Cloud className="h-8 w-8 text-green-600 mr-3" />
                    <CardTitle className="text-2xl">Modern Cloud Architecture</CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    Built with 2025 technology stack
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Microservices architecture</strong>
                        <p className="text-gray-600 text-sm">
                          Independent services enabling rapid, safe deployments
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Cloud-native infrastructure</strong>
                        <p className="text-gray-600 text-sm">
                          Auto-scaling, 99.9% uptime, zero maintenance burden
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Offline-first mobile apps</strong>
                        <p className="text-gray-600 text-sm">
                          Technicians work seamlessly without connectivity
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Modern PostgreSQL + AI/ML stack</strong>
                        <p className="text-gray-600 text-sm">
                          Supports real-time analytics and predictive models
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Weekly releases</strong>
                        <p className="text-gray-600 text-sm">
                          52 releases per year with instant deployment
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">API-first integrations</strong>
                        <p className="text-gray-600 text-sm">
                          Connect any system with RESTful APIs and webhooks
                        </p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Technical Stack */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Modern Technology Stack</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Built with industry-leading technologies for performance, scalability, and developer
                velocity
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 hover:border-blue-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                    <Code className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    React + TypeScript Frontend
                  </h3>
                  <p className="text-gray-600">
                    Modern, type-safe UI framework enabling rich, responsive interfaces that work
                    flawlessly across desktop, tablet, and mobile devices.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-purple-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                    <Database className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">PostgreSQL + Drizzle ORM</h3>
                  <p className="text-gray-600">
                    Enterprise-grade relational database with advanced features like JSONB,
                    full-text search, and optimized for both OLTP and analytics workloads.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-green-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
                    <Cloud className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Cloud-Native Infrastructure
                  </h3>
                  <p className="text-gray-600">
                    Built on serverless cloud platform with auto-scaling, global CDN, automated
                    backups, and 99.9% uptime SLA.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-orange-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Data Sync</h3>
                  <p className="text-gray-600">
                    WebSocket-based real-time updates ensure all users see changes instantly. No
                    page refreshes required—changes appear as they happen.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-red-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Enterprise Security</h3>
                  <p className="text-gray-600">
                    Row-level security, encrypted data at rest and in transit, SOC 2 compliance, and
                    granular role-based access control.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-indigo-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                    <Smartphone className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Offline-First Mobile</h3>
                  <p className="text-gray-600">
                    Native mobile experience with offline-first architecture. Technicians work
                    seamlessly without connectivity, auto-sync when online.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Innovation Velocity */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Innovation Velocity: 13x Faster Than Legacy
              </h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                Modern architecture enables rapid iteration and continuous improvement
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">52</div>
                <div className="text-blue-100 mb-4">Releases per year</div>
                <p className="text-sm text-blue-200">
                  Weekly updates with new features, improvements, and fixes. Legacy systems: 4 per
                  year.
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">&lt;5min</div>
                <div className="text-blue-100 mb-4">Zero-downtime deploys</div>
                <p className="text-sm text-blue-200">
                  Updates deploy instantly without interrupting users. Legacy systems: hours of
                  downtime.
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">24/7</div>
                <div className="text-blue-100 mb-4">Continuous monitoring</div>
                <p className="text-sm text-blue-200">
                  Automated monitoring detects and resolves issues before users notice.
                </p>
              </div>
            </div>

            <Card className="mt-12 bg-white/10 backdrop-blur-sm border-2 border-white/20">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-4">What This Means for Your Dealership</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="block mb-1">Always Up-to-Date</strong>
                      <span className="text-blue-100 text-sm">
                        New features appear automatically, no IT required
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="block mb-1">Fast Bug Fixes</strong>
                      <span className="text-blue-100 text-sm">
                        Issues resolved in days, not months
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="block mb-1">Rapid Feature Requests</strong>
                      <span className="text-blue-100 text-sm">
                        Customer requests implemented weekly
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="block mb-1">Latest ML Techniques</strong>
                      <span className="text-blue-100 text-sm">
                        AI improvements deployed continuously
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why It Takes 2-3 Years to Catch Up */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why Competitors Need 2-3 Years to Catch Up
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Rebuilding fundamental architecture isn't a quick project. Here's the minimum
                timeline:
              </p>
            </div>

            <div className="space-y-6 max-w-4xl mx-auto">
              <Card className="border-l-4 border-blue-600">
                <CardContent className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600">18-24</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Database Architecture Rebuild
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Migrating from proprietary databases to modern PostgreSQL while maintaining
                        backward compatibility. Requires schema redesign, data migration, and
                        extensive testing.
                      </p>
                      <p className="text-sm text-gray-600">
                        Plus: Training developers on new stack, updating all queries and data access
                        patterns.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-purple-600">
                <CardContent className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-600">12-18</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Frontend Complete Rewrite
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Rebuilding desktop UI from scratch with React/Vue/Angular. Creating
                        offline-first mobile apps with true native functionality, not web wrappers.
                      </p>
                      <p className="text-sm text-gray-600">
                        Plus: UI/UX redesign, accessibility compliance, responsive layouts for all
                        screen sizes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-green-600">
                <CardContent className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-green-600">12-18</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">AI/ML Infrastructure</h3>
                      <p className="text-gray-700 mb-3">
                        Building cloud infrastructure for ML training, deploying models, automated
                        retraining pipelines, A/B testing framework, and prediction serving at
                        scale.
                      </p>
                      <p className="text-sm text-gray-600">
                        Plus: Hiring ML engineers, collecting training data, tuning models,
                        validating accuracy.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-orange-600">
                <CardContent className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-orange-600">Ongoing</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">We Keep Innovating</h3>
                      <p className="text-gray-700 mb-3">
                        While competitors rebuild their foundation, we're shipping 52 releases per
                        year with new features, AI improvements, and platform enhancements.
                      </p>
                      <p className="text-sm text-gray-600">
                        The gap widens every week they delay the transition.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <Card className="inline-block border-2 border-blue-300 bg-blue-50">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Total Timeline: 2.5-3.5 Years Minimum
                  </h3>
                  <p className="text-gray-700 max-w-2xl">
                    And that's assuming they start today with a well-funded team. Most legacy
                    vendors are still debating whether to make the investment.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Experience Modern Architecture Today
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Don't wait 2-3 years for your current vendor to catch up. Join forward-thinking
              dealers who've already made the switch to modern cloud architecture.
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
                onClick={() =>
                  (window.location.href = '/blog/e-automate-vs-modern-cloud-platforms')
                }
              >
                Compare vs. E-Automate
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
                  Modern Architecture • Predictive Intelligence • Integration Marketplace
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ModernArchitecture;
