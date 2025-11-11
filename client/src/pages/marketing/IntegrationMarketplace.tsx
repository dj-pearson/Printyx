import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Network, Plug, Zap, TrendingUp, Users, Lock, Printer } from "lucide-react";

const IntegrationMarketplace = () => {
  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Integration Marketplace - Network Effects That Compound Over Time",
          "description": "Printyx's integration marketplace connects your dealer ecosystem. Pre-built integrations for accounting, CRM, MPS tools, and more. API-first platform that grows more valuable as the network expands.",
          "url": "https://printyx.com/integration-marketplace",
          "mainEntity": {
            "@type": "SoftwareApplication",
            "name": "Printyx Integration Marketplace",
            "applicationCategory": "BusinessApplication"
          }
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
                  onClick={() => window.location.href = '/'}
                  className="hover:bg-gray-100"
                >
                  <Printer className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">Printyx</span>
                </Button>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/login'}
                >
                  Login
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                  onClick={() => window.location.href = '/signup'}
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
                Network Effects Moat
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Your Ecosystem.<br />
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  All Connected.
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed mb-8">
                Legacy systems lock you into rigid workflows and limited integrations. Printyx's API-first platform
                connects your entire ecosystem—and becomes more powerful as the network grows.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-10 py-7"
                  onClick={() => window.location.href = '/signup'}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 py-7 border-2 border-white text-white hover:bg-white hover:text-blue-600"
                  onClick={() => window.location.href = '/login'}
                >
                  Explore Integrations
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Categories */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Pre-Built Integrations Across Your Stack
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Connect the tools you already use—or discover new ones in our growing marketplace
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 hover:border-blue-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Accounting Systems</h3>
                  <p className="text-gray-600 mb-4">
                    Seamless sync with QuickBooks, NetSuite, Sage, and more. Automated invoice creation, payment tracking, and reconciliation.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• QuickBooks Online/Desktop</li>
                    <li>• NetSuite ERP</li>
                    <li>• Sage Intacct</li>
                    <li>• Xero Accounting</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-purple-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">CRM Platforms</h3>
                  <p className="text-gray-600 mb-4">
                    Bi-directional sync with leading CRMs. Keep customer data, opportunities, and activities aligned across systems.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Salesforce</li>
                    <li>• HubSpot CRM</li>
                    <li>• Microsoft Dynamics</li>
                    <li>• Zoho CRM</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-orange-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
                    <Network className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">E-Automate Migration</h3>
                  <p className="text-gray-600 mb-4">
                    Proven migration tools for e-automate data. Import customers, equipment, contracts, and service history with zero data loss.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Customer migration</li>
                    <li>• Equipment history</li>
                    <li>• Contract conversion</li>
                    <li>• Service records</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-red-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Sales & Lead Gen</h3>
                  <p className="text-gray-600 mb-4">
                    Enrich leads with business intelligence from Apollo, ZoomInfo, and more. Automated prospect research and qualification.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Apollo.io</li>
                    <li>• ZoomInfo</li>
                    <li>• LinkedIn Sales Nav</li>
                    <li>• Clearbit Enrichment</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-indigo-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                    <Printer className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">MPS & Fleet Tools</h3>
                  <p className="text-gray-600 mb-4">
                    Connect managed print service platforms for automated meter collection, supplies ordering, and fleet monitoring.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• PrintFleet/FM Audit</li>
                    <li>• EveryonePrint</li>
                    <li>• PaperCut</li>
                    <li>• Print Manager Plus</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-blue-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                    <Plug className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Custom Integrations</h3>
                  <p className="text-gray-600 mb-4">
                    Build custom integrations with our RESTful API, webhooks, and developer tools. Full API documentation and support.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• RESTful API</li>
                    <li>• Webhook events</li>
                    <li>• OAuth 2.0</li>
                    <li>• Developer portal</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Network Effects */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Network Effects: The Advantage That Compounds
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Unlike features competitors can copy, network effects create an expanding moat over time
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-xl">More Dealers = More Integrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    As our dealer network grows, partners build more integrations targeting our platform.
                    Each new integration makes Printyx more valuable for all dealers.
                  </p>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 font-semibold mb-2">Current Growth:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 15+ pre-built integrations live</li>
                      <li>• 8 more in development</li>
                      <li>• Partners request access weekly</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-xl">Shared Innovation Pool</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Dealers share workflows, templates, and best practices through the marketplace.
                    Your competitors on legacy systems can't access this collective intelligence.
                  </p>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 font-semibold mb-2">Community Resources:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Workflow templates library</li>
                      <li>• Email sequences database</li>
                      <li>• Contract templates</li>
                      <li>• Pricing strategies</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardHeader>
                  <CardTitle className="text-xl">Data Network Effects</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Our AI models improve as more dealers use the platform. More data = better
                    predictions, pricing optimization, and automated workflows for everyone.
                  </p>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 font-semibold mb-2">Continuous Improvement:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Better failure predictions</li>
                      <li>• Smarter pricing models</li>
                      <li>• Optimized routes</li>
                      <li>• Industry benchmarks</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* API-First Advantage */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                API-First Platform Built for Integration
              </h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                Legacy systems bolt on APIs as afterthoughts. We built Printyx API-first from day one.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-white/10 backdrop-blur-sm border-2 border-white/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4">Modern API Design</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">RESTful Architecture</strong>
                        <span className="text-blue-100 text-sm">Standard HTTP methods, JSON responses, predictable endpoints</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Webhook Events</strong>
                        <span className="text-blue-100 text-sm">Real-time notifications for data changes</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">OAuth 2.0 Security</strong>
                        <span className="text-blue-100 text-sm">Industry-standard authentication and authorization</span>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-2 border-white/20">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4">Developer Experience</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Comprehensive Documentation</strong>
                        <span className="text-blue-100 text-sm">Every endpoint documented with examples</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">Interactive API Explorer</strong>
                        <span className="text-blue-100 text-sm">Test endpoints directly in browser</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">SDK Libraries</strong>
                        <span className="text-blue-100 text-sm">Pre-built clients for popular languages</span>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Why This Moat Grows */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why Competitors Can't Replicate This Advantage
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Network effects compound over time—the early leader wins
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              <Card className="border-l-4 border-blue-600">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">First-Mover Advantage</h3>
                  <p className="text-gray-700">
                    We're building the dealer ecosystem now. By the time legacy vendors realize they need
                    an integration marketplace, we'll have 50+ integrations and thousands of active dealers.
                    Partners won't build for a platform with no users.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-purple-600">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Switching Costs Increase</h3>
                  <p className="text-gray-700">
                    As dealers build custom integrations, import workflow templates, and rely on
                    network-exclusive features, the cost of switching away increases exponentially.
                    We become embedded in their operations.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-green-600">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Data Moat Expands</h3>
                  <p className="text-gray-700">
                    Every new dealer makes our AI smarter for all dealers. Competitors starting from zero
                    would need years to collect equivalent training data—and by then, we're even further ahead.
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
              Join the Growing Network
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Every week you wait, our network grows stronger and the gap widens.
              Be an early adopter and benefit from the compounding advantages.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-10 py-7"
                onClick={() => window.location.href = '/signup'}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 py-7 border-2 border-white text-white hover:bg-white hover:text-blue-600"
                onClick={() => window.location.href = '/login'}
              >
                Explore API Docs
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
                  Integration Marketplace • Predictive Intelligence • Modern Architecture
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default IntegrationMarketplace;
