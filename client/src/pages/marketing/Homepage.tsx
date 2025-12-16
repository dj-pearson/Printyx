import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  ArrowRight,
  CheckCircle,
  Users,
  Shield,
  BarChart3,
  Calendar,
  Wrench,
  FileText,
  TrendingUp,
  Printer,
  Menu,
  Activity,
  Zap,
  Brain,
  Rocket,
} from 'lucide-react';
import Interactive3DHero from '@/components/marketing/Interactive3DHero';

const Homepage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: 'Predictive Equipment Failure Detection',
      description:
        'AI analyzes service history, usage patterns, and equipment data to predict failures 30 days in advance. Prevent 30-40% of emergency service calls with proactive maintenance.',
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      benefits: [
        '80%+ prediction accuracy',
        '30-day failure warning',
        'Automated parts pre-ordering',
      ],
      badge: 'AI-Powered Intelligence',
    },
    {
      icon: BarChart3,
      title: 'Dynamic Contract Profitability Engine',
      description:
        'Real-time profitability analysis with AI-powered pricing recommendations. Identify underpriced contracts and optimize margins automatically. Increase profitability by 15-25%.',
      color: 'bg-gradient-to-br from-green-500 to-green-600',
      benefits: [
        'Real-time margin tracking',
        'Intelligent pricing recommendations',
        'Churn risk scoring',
      ],
      badge: 'Revenue Intelligence',
    },
    {
      icon: Calendar,
      title: 'Smart Service Dispatch',
      description:
        'AI-optimized routing with predictive scheduling. Offline-first mobile app works anywhere. Reduce travel time by 40% and increase daily service calls by 30%.',
      color: 'bg-gradient-to-br from-purple-500 to-purple-600',
      benefits: [
        'AI route optimization',
        'Works offline 72 hours',
        'Real-time technician tracking',
      ],
      badge: 'Mobile Excellence',
    },
    {
      icon: Users,
      title: 'Natural Language CRM',
      description:
        "Ask questions in plain English. 'Show me profitable Xerox contracts' or 'Customers at high churn risk'. AI understands intent, not just keywords.",
      color: 'bg-gradient-to-br from-orange-500 to-orange-600',
      benefits: ['Conversational interface', 'Semantic search', 'AI-powered recommendations'],
      badge: 'Conversational AI',
    },
    {
      icon: FileText,
      title: 'Automated Workflow Engine',
      description:
        'No-code automation builder. One-click contract renewals, automatic collections, and smart follow-ups. Eliminate 60% of manual data entry.',
      color: 'bg-gradient-to-br from-red-500 to-red-600',
      benefits: ['Visual workflow builder', '50+ pre-built templates', 'Zero-touch billing'],
      badge: 'Automation',
    },
    {
      icon: Shield,
      title: 'Integration Marketplace',
      description:
        'Connect to 20+ manufacturer systems, accounting platforms, and business tools. Open API with growing partner ecosystem. Network effects compound value over time.',
      color: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      benefits: ['20+ integrations', 'Open REST API', 'Partner ecosystem'],
      badge: 'Ecosystem',
    },
  ];

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Technical Superiority: 2-3 Year Head Start',
      description:
        'Modern cloud-native architecture built on React, PostgreSQL, and AI/ML infrastructure. While competitors struggle with legacy codebases, we iterate and innovate weekly. Impossible to catch up without a complete platform rebuild.',
      highlight: 'Modern vs. Legacy',
    },
    {
      icon: Activity,
      title: 'Intelligence Layer: Predictive vs. Reactive',
      description:
        'AI models trained on dealer operations data predict equipment failures, optimize pricing, and identify opportunities. Competitors offer basic reporting—we offer intelligence that learns and improves daily. Cannot be replicated without massive ML investment.',
      highlight: 'AI-Powered',
    },
    {
      icon: Users,
      title: 'Network Effects: Growing Ecosystem',
      description:
        'Integration marketplace with 20+ partners and growing. Every integration makes the platform more valuable. Every dealer using our platform improves our AI models. Value compounds exponentially—competitors start at zero.',
      highlight: 'Marketplace',
    },
    {
      icon: Printer,
      title: 'Domain Expertise: Built by Dealer Operators',
      description:
        'Deep understanding of copier dealer operations from meter billing quirks to service dispatch realities. Every feature designed for real workflows, not abstract ERP concepts. Defensible through execution excellence.',
      highlight: 'Industry-Specific',
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Owner, TechCopy Solutions',
      content:
        'Printyx has completely transformed how we manage our business. What used to take hours now takes minutes.',
      rating: 5,
    },
    {
      name: 'Mike Chen',
      role: 'Operations Manager, Copy Pro',
      content:
        'The unified dashboard gives us real-time visibility into every aspect of our operation. Game-changing.',
      rating: 5,
    },
    {
      name: 'Lisa Rodriguez',
      role: 'Service Director, Office Solutions Inc',
      content:
        'Our technicians love the mobile app, and our customers love the faster service. Win-win.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo className="h-8 w-8" />
              <span className="ml-2 text-xl font-bold text-gray-900">Printyx</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">
                Features
              </a>
              <a href="#benefits" className="text-gray-700 hover:text-blue-600 transition-colors">
                Benefits
              </a>
              <a href="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
                Blog
              </a>
              <a
                href="#testimonials"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Testimonials
              </a>
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                onClick={() => (window.location.href = '/login')}
              >
                Login
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={() => (window.location.href = '/signup')}
              >
                Start Free Trial
              </Button>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <div className="flex flex-col space-y-4 mt-4">
                    <a
                      href="#features"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Features
                    </a>
                    <a
                      href="#benefits"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Benefits
                    </a>
                    <a
                      href="/blog"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Blog
                    </a>
                    <a
                      href="#testimonials"
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Testimonials
                    </a>
                    <Button
                      variant="outline"
                      className="w-full border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        window.location.href = '/login';
                      }}
                    >
                      Login
                    </Button>
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      onClick={() => {
                        window.location.href = '/signup';
                      }}
                    >
                      Start Free Trial
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Revolutionary 3D Hero Section */}
      <Interactive3DHero />

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 text-base px-4 py-2">
              Predictive Intelligence Platform
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Stop Reacting. Start Predicting.
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI-powered features that prevent problems before they happen, optimize pricing
              automatically, and transform copier dealer operations from reactive to predictive.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`transform transition - all duration - 700 delay - ${
                  index * 100
                } hover: scale - 105 hover: shadow - xl border - 2 hover: border - blue - 300 ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                } `}
              >
                <CardHeader>
                  <Badge className="mb-3 bg-blue-50 text-blue-700 border-blue-200 w-fit">
                    {feature.badge}
                  </Badge>
                  <div
                    className={`inline - flex items - center justify - center w - 14 h - 14 ${feature.color} rounded - xl mb - 4 shadow - lg`}
                  >
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4 text-gray-700">
                    {feature.description}
                  </CardDescription>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-sm font-medium">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Competitive Advantages Section */}
      <section id="benefits" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 text-base px-4 py-2">
              Unbeatable Competitive Moats
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Competitors Can't Catch Up
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Four strategic advantages that compound over time and create an insurmountable lead
              over legacy dealer management systems.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            {benefits.map((benefit, index) => (
              <Card
                key={index}
                className={`transform transition - all duration - 700 delay - ${
                  index * 150
                } hover: shadow - 2xl border - 2 hover: border - purple - 300 ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                } `}
              >
                <CardContent className="p-8">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                        <benefit.icon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Badge className="mb-3 bg-purple-50 text-purple-700 border-purple-200">
                        {benefit.highlight}
                      </Badge>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                      <p className="text-base text-gray-700 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ROI Stats */}
          <div className="mt-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Measurable Business Impact</h3>
              <p className="text-xl text-blue-100">
                Real results from copier dealers using Printyx
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-5xl font-bold mb-2">15-25%</div>
                <div className="text-blue-100">Profitability Increase</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">30-40%</div>
                <div className="text-blue-100">Fewer Emergency Calls</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">60%</div>
                <div className="text-blue-100">Less Manual Work</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">80%+</div>
                <div className="text-blue-100">Failure Prediction Accuracy</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Comparison Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-red-100 text-red-800 border-red-300 text-base px-4 py-2">
              Legacy vs. Modern
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Stop Fighting With Legacy Systems
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See why dealers are switching from e-automate and other legacy platforms to Printyx's
              modern, AI-powered architecture.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Legacy Systems */}
            <Card className="border-2 border-red-200 bg-red-50/50">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-2xl font-bold text-red-900">Legacy Systems</CardTitle>
                  <Badge variant="destructive">Reactive</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✕</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Reactive Operations</p>
                    <p className="text-sm text-gray-600">
                      Wait for equipment to fail, then react. No predictive insights.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✕</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Legacy Architecture</p>
                    <p className="text-sm text-gray-600">
                      10+ year old codebase. Slow updates, expensive customization.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✕</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Manual Pricing</p>
                    <p className="text-sm text-gray-600">
                      Guess at contract pricing. No profitability intelligence.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✕</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Closed Ecosystem</p>
                    <p className="text-sm text-gray-600">
                      Limited integrations. Vendor lock-in. Expensive add-ons.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✕</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Desktop-First Mobile</p>
                    <p className="text-sm text-gray-600">
                      Mobile app is an afterthought. Requires constant connectivity.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Printyx Platform */}
            <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-blue-50 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Printyx Platform
                  </CardTitle>
                  <Badge className="bg-green-600 text-white">Predictive</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Predictive Intelligence</p>
                    <p className="text-sm text-gray-700">
                      AI predicts failures 30 days ahead. Prevent 30-40% of emergencies.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Modern Cloud Architecture</p>
                    <p className="text-sm text-gray-700">
                      Built in 2024 on React, PostgreSQL, AI/ML. 2-3 year technical lead.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">AI-Powered Pricing</p>
                    <p className="text-sm text-gray-700">
                      Dynamic pricing engine. Increase margins 15-25% automatically.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Integration Marketplace</p>
                    <p className="text-sm text-gray-700">
                      20+ integrations and growing. Open API. Network effects.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Offline-First Mobile</p>
                    <p className="text-sm text-gray-700">
                      Works offline 72 hours. Built for field technicians.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-300 text-base px-4 py-2">
              Dealer Success Stories
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real feedback from copier dealers who switched to predictive operations and never
              looked back.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className={`transform transition - all duration - 700 delay - ${
                  index * 150
                } hover: shadow - lg border - 2 hover: border - blue - 300 ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                } `}
              >
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-xl">
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic text-lg">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial - gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Badge className="mb-6 bg-white/20 text-white border-white/30 text-base px-4 py-2 backdrop-blur-sm">
            Join the Predictive Revolution
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Stop Reacting. Start Predicting.
            <br />
            Switch to Modern Architecture Today.
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
            Join forward-thinking dealers who chose predictive intelligence over legacy systems.
            Increase profitability by 15-25% while competitors struggle with outdated technology.
          </p>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Rocket className="h-10 w-10 text-white mx-auto mb-3" />
              <p className="text-white font-semibold">2-3 Year Technical Advantage</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Brain className="h-10 w-10 text-white mx-auto mb-3" />
              <p className="text-white font-semibold">AI-Powered Intelligence</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Zap className="h-10 w-10 text-white mx-auto mb-3" />
              <p className="text-white font-semibold">Impossible to Replicate</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 hover:scale-105 transition-transform px-6 py-4 text-base md:text-lg md:px-10 md:py-7 shadow-2xl"
              onClick={() => (window.location.href = '/signup')}
            >
              Start Free Trial - See the Difference
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-6 py-4 text-base md:text-lg md:px-10 md:py-7 border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-all"
              onClick={() => (window.location.href = '/login')}
            >
              Watch Platform Demo
            </Button>
          </div>

          <p className="text-blue-100 mt-6 text-sm">
            No credit card required • 30-day free trial • Migration support included
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Company Info */}
            <div className="md:col-span-1">
              <div className="flex items-center mb-4">
                <Logo className="h-8 w-8" />
                <span className="ml-2 text-xl font-bold">Printyx</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                The AI-powered predictive intelligence platform for copier dealers. Modern
                architecture, 2-3 year technical advantage over legacy systems.
              </p>
              <div className="flex space-x-4">
                <Badge className="bg-blue-600 text-white">AI-Powered</Badge>
                <Badge className="bg-purple-600 text-white">Modern</Badge>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-white mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Predictive Intelligence
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Contract Profitability
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Smart Service Dispatch
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Integration Marketplace
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Mobile App
                  </a>
                </li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="font-semibold text-white mb-4">Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#benefits" className="text-gray-400 hover:text-white transition-colors">
                    AI Equipment Failure Detection
                  </a>
                </li>
                <li>
                  <a href="#benefits" className="text-gray-400 hover:text-white transition-colors">
                    Dynamic Pricing Engine
                  </a>
                </li>
                <li>
                  <a href="#benefits" className="text-gray-400 hover:text-white transition-colors">
                    Workflow Automation
                  </a>
                </li>
                <li>
                  <a href="#benefits" className="text-gray-400 hover:text-white transition-colors">
                    Revenue Intelligence
                  </a>
                </li>
                <li>
                  <a href="#benefits" className="text-gray-400 hover:text-white transition-colors">
                    Natural Language CRM
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#testimonials"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Customer Stories
                  </a>
                </li>
                <li>
                  <a href="/login" className="text-gray-400 hover:text-white transition-colors">
                    Login
                  </a>
                </li>
                <li>
                  <a href="/signup" className="text-gray-400 hover:text-white transition-colors">
                    Start Free Trial
                  </a>
                </li>
                <li>
                  <span className="text-gray-400">Support</span>
                </li>
                <li>
                  <span className="text-gray-400">Documentation</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-center md:text-left mb-4 md:mb-0">
                <p className="text-gray-400 text-sm">© 2025 Printyx. All rights reserved.</p>
                <p className="text-xs text-gray-500 mt-1">
                  AI-Powered Dealer Management • Predictive vs. Reactive • Modern Cloud Architecture
                </p>
              </div>
              <div className="flex space-x-6 text-sm">
                <span className="text-gray-400">Privacy Policy</span>
                <span className="text-gray-400">Terms of Service</span>
                <span className="text-gray-400">Security</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
