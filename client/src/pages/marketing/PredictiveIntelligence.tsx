import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, TrendingUp, AlertTriangle, Zap, Target, Brain, BarChart3, Printer } from "lucide-react";

const PredictiveIntelligence = () => {
  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Predictive Intelligence for Copier Dealers - Stop Reacting, Start Predicting",
          "description": "Transform your copier dealership with AI-powered predictive intelligence. Prevent equipment failures 30 days in advance, reduce emergency calls by 30-40%, and optimize operations with machine learning.",
          "url": "https://printyx.com/predictive-intelligence",
          "mainEntity": {
            "@type": "SoftwareApplication",
            "name": "Printyx Predictive Intelligence",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD",
              "description": "14-day free trial"
            }
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
                Our #1 Competitive Advantage
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Stop Reacting.<br />
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  Start Predicting.
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed mb-8">
                While competitors scramble to fix equipment failures, you'll prevent them 30 days in advance.
                AI-powered predictive intelligence transforms copier dealer operations from reactive chaos to proactive precision.
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
                  onClick={() => window.location.href = '/blog/ai-predictive-maintenance-vs-reactive-service'}
                >
                  Read Technical Deep-Dive
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* The Reactive Problem */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                The Reactive Model is Broken
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Most dealers still operate the same way they did 20 years ago: equipment fails, customers call,
                technicians rush out. It's expensive, inefficient, and frustrating for everyone.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2 border-red-200 bg-red-50/30">
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                    <CardTitle className="text-2xl">Reactive Service Model</CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    The legacy approach that costs dealers $200K-$400K annually
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <div>
                        <strong className="text-gray-900">Emergency calls cost 2-3x more</strong>
                        <p className="text-gray-600 text-sm">Rushed trips, overtime labor, expedited parts orders</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <div>
                        <strong className="text-gray-900">Customer downtime damages reputation</strong>
                        <p className="text-gray-600 text-sm">Unexpected failures mean lost productivity and unhappy clients</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <div>
                        <strong className="text-gray-900">Scheduling chaos wastes time</strong>
                        <p className="text-gray-600 text-sm">Planned routes disrupted by emergency runs</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-red-600 rounded-full mr-3 mt-2"></div>
                      <div>
                        <strong className="text-gray-900">Inventory management nightmare</strong>
                        <p className="text-gray-600 text-sm">Either overstocked (cash tied up) or understocked (delays)</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-300 bg-green-50/30">
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <Brain className="h-8 w-8 text-green-600 mr-3" />
                    <CardTitle className="text-2xl">Predictive Intelligence Model</CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    AI-powered platform that prevents problems before they happen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Predict failures 30 days in advance</strong>
                        <p className="text-gray-600 text-sm">80%+ accuracy using ML pattern recognition</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">30-40% reduction in emergency calls</strong>
                        <p className="text-gray-600 text-sm">Proactive maintenance prevents catastrophic failures</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Optimized scheduling and routing</strong>
                        <p className="text-gray-600 text-sm">Plan maintenance during convenient times</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Automated parts ordering</strong>
                        <p className="text-gray-600 text-sm">Order exactly what you need, when you need it</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                How Predictive Intelligence Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Our AI engine analyzes multiple data sources to predict equipment failures before they happen
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-2 hover:border-blue-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                    <BarChart3 className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">1. Data Collection</h3>
                  <p className="text-gray-600 mb-3">
                    Continuously gather data from service history, meter readings, equipment specs, and technician notes.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Service request patterns</li>
                    <li>• Usage velocity changes</li>
                    <li>• Equipment age and model</li>
                    <li>• Historical failure data</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-purple-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">2. Pattern Recognition</h3>
                  <p className="text-gray-600 mb-3">
                    ML algorithms identify failure patterns invisible to humans across thousands of devices.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Pre-failure indicators</li>
                    <li>• Error code combinations</li>
                    <li>• Service frequency patterns</li>
                    <li>• Seasonal variations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-green-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">3. Predictive Scoring</h3>
                  <p className="text-gray-600 mb-3">
                    Each device receives a health score (0-100) with specific failure predictions and timelines.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Probability percentages</li>
                    <li>• Component-level predictions</li>
                    <li>• Timeline forecasts</li>
                    <li>• Parts recommendations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-orange-400 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">4. Proactive Action</h3>
                  <p className="text-gray-600 mb-3">
                    System automatically triggers preventive actions before failures occur.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Auto service requests</li>
                    <li>• Parts ordering</li>
                    <li>• Schedule optimization</li>
                    <li>• Customer notifications</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Real Results from Real Dealers
              </h2>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                Dealers who implement predictive intelligence see dramatic improvements across every metric
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">30-40%</div>
                <div className="text-blue-100">Reduction in emergency service calls</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">20%</div>
                <div className="text-blue-100">Decrease in total service costs</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">25%</div>
                <div className="text-blue-100">Reduction in customer downtime</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">80%+</div>
                <div className="text-blue-100">Prediction accuracy rate</div>
              </div>
            </div>

            <Card className="mt-12 bg-white/10 backdrop-blur-sm border-2 border-white/20">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-4">Case Study: Mid-Sized Dealer</h3>
                <p className="text-blue-100 mb-4">
                  A 15-technician dealer in the Southeast implemented predictive intelligence in Q1 2024:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Emergency calls: 180/month → 112/month (38% reduction)</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Service costs decreased $47,000 annually</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Customer satisfaction: 3.8 → 4.4 (out of 5)</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Contract renewal rate: 82% → 91%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why Competitors Can't Copy This */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why This is Impossible to Replicate Quickly
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                This isn't a feature you can bolt onto legacy systems. It requires fundamental architectural changes that take years to build.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Modern Data Infrastructure</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    ML models require cloud-native databases optimized for time-series analysis and pattern recognition.
                  </p>
                  <p className="text-sm text-gray-600">
                    Legacy systems store data in outdated formats designed for transactions, not ML training.
                    Rebuilding data architecture takes 18-24 months minimum.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">GPU-Accelerated ML Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Training accurate prediction models requires modern cloud infrastructure with GPU acceleration.
                  </p>
                  <p className="text-sm text-gray-600">
                    On-premise legacy systems lack the computational resources for real-time predictions at scale.
                    Building this infrastructure from scratch takes 12-18 months.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Continuous Learning Systems</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">
                    Effective AI improves daily through automated retraining pipelines and A/B testing infrastructure.
                  </p>
                  <p className="text-sm text-gray-600">
                    Legacy vendors update quarterly at best. Our platform iterates weekly with the latest ML techniques.
                    Catching up requires complete development process transformation.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <Card className="inline-block border-2 border-blue-300 bg-blue-50">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Our 2-3 Year Technical Advantage
                  </h3>
                  <p className="text-gray-700 max-w-2xl">
                    We've been building this infrastructure since day one. Legacy vendors would need to:
                  </p>
                  <ul className="text-left mt-4 space-y-2 text-gray-700">
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      Rebuild database architecture (18-24 months)
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      Build ML infrastructure and pipelines (12-18 months)
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      Collect training data and tune models (6-12 months)
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      And we keep innovating while they play catch-up
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Stop Reacting. Start Predicting.
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join forward-thinking dealers who are transforming their operations with predictive intelligence.
              See the platform in action with a free 14-day trial.
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
                onClick={() => window.location.href = '/blog/ai-predictive-maintenance-vs-reactive-service'}
              >
                Read Technical Deep-Dive
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
                  Predictive Intelligence • Modern Architecture • Integration Marketplace
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default PredictiveIntelligence;
