import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  ArrowRight, 
  CheckCircle, 
  Users, 
  DollarSign, 
  Zap, 
  Shield,
  BarChart3,
  Calendar,
  Wrench,
  FileText,
  TrendingUp,
  Star,
  Printer,
  Building2,
  Clock,
  Target,
  Menu,
  X
} from "lucide-react";

const Homepage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: BarChart3,
      title: "Automated Meter Billing",
      description: "Eliminate manual billing processes with automated meter reading and invoice generation. Save 15+ hours per week on billing operations.",
      color: "bg-blue-500",
      benefits: ["95% billing accuracy", "Automatic invoice generation", "Real-time meter tracking"]
    },
    {
      icon: Calendar,
      title: "Smart Service Dispatch",
      description: "Optimize technician scheduling with intelligent routing and availability management. Reduce travel time by 40%.",
      color: "bg-green-500",
      benefits: ["GPS-based routing", "Real-time scheduling", "Mobile technician app"]
    },
    {
      icon: Users,
      title: "Unified CRM System",
      description: "Manage customer relationships, leads, and sales pipeline in one integrated platform. Increase sales conversion by 35%.",
      color: "bg-purple-500",
      benefits: ["Lead scoring", "Pipeline tracking", "Customer history"]
    },
    {
      icon: FileText,
      title: "Contract Management",
      description: "Track service agreements, lease terms, and billing cycles with automated renewals. Never miss a renewal again.",
      color: "bg-orange-500",
      benefits: ["Automated renewals", "Contract analytics", "E-signature integration"]
    },
    {
      icon: Shield,
      title: "Inventory Control",
      description: "Real-time parts tracking with automatic reorder points and supplier management. Reduce inventory costs by 25%.",
      color: "bg-red-500",
      benefits: ["Low stock alerts", "Automated ordering", "Cost tracking"]
    },
    {
      icon: TrendingUp,
      title: "Business Analytics",
      description: "Comprehensive reporting and analytics to make data-driven decisions. Access 50+ pre-built reports.",
      color: "bg-indigo-500",
      benefits: ["Custom dashboards", "Financial reports", "Performance metrics"]
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$99",
      period: "per month",
      description: "Perfect for small copier dealers getting started",
      features: [
        "Up to 100 customers",
        "Basic CRM & invoicing",
        "Email support",
        "Mobile app access",
        "Standard reporting"
      ],
      popular: false,
      cta: "Start Free Trial"
    },
    {
      name: "Professional",
      price: "$199",
      period: "per month",
      description: "Ideal for growing businesses with advanced needs",
      features: [
        "Up to 500 customers",
        "Advanced meter billing",
        "Service dispatch optimization",
        "Priority phone support",
        "Custom reports & analytics",
        "API access"
      ],
      popular: true,
      cta: "Start Free Trial"
    },
    {
      name: "Enterprise",
      price: "$399",
      period: "per month",
      description: "Full-featured solution for large operations",
      features: [
        "Unlimited customers",
        "Multi-location support",
        "Advanced RBAC & teams",
        "Dedicated account manager",
        "Custom integrations",
        "White-label options"
      ],
      popular: false,
      cta: "Contact Sales"
    }
  ];

  const tools = [
    {
      icon: Printer,
      title: "Equipment Database",
      description: "Comprehensive database of copier models, specifications, and service procedures"
    },
    {
      icon: Wrench,
      title: "Service Tools",
      description: "Digital service manuals, troubleshooting guides, and diagnostic tools"
    },
    {
      icon: BarChart3,
      title: "Business Intelligence",
      description: "Advanced analytics, forecasting, and performance optimization tools"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Communication tools, task management, and knowledge sharing platforms"
    }
  ];

  const resources = [
    {
      category: "Documentation",
      items: [
        { title: "Getting Started Guide", description: "Complete setup and onboarding documentation" },
        { title: "API Reference", description: "Comprehensive API documentation for developers" },
        { title: "User Manual", description: "Detailed user guides for all platform features" }
      ]
    },
    {
      category: "Training",
      items: [
        { title: "Video Tutorials", description: "Step-by-step video guides for common tasks" },
        { title: "Webinar Series", description: "Monthly training sessions and product updates" },
        { title: "Certification Program", description: "Professional certification for platform expertise" }
      ]
    },
    {
      category: "Support",
      items: [
        { title: "Help Center", description: "Searchable knowledge base with instant answers" },
        { title: "Community Forum", description: "Connect with other dealers and share best practices" },
        { title: "Technical Support", description: "24/7 technical support for all plan levels" }
      ]
    }
  ];

  const stats = [
    { number: "4,762", label: "Copier Dealers Served", icon: Building2 },
    { number: "$39.3B", label: "Market Size", icon: DollarSign },
    { number: "85%", label: "Billing Accuracy", icon: Target },
    { number: "60%", label: "Time Savings", icon: Clock }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Operations Manager",
      company: "Metro Copy Solutions",
      content: "Printyx transformed our operations. We've reduced billing errors by 90% and our technicians are 40% more efficient.",
      rating: 5
    },
    {
      name: "Mike Chen",
      role: "Owner",
      company: "Pacific Office Equipment",
      content: "The unified platform eliminated our need for 5 different systems. ROI was achieved in just 3 months.",
      rating: 5
    },
    {
      name: "Lisa Rodriguez",
      role: "Service Director",
      company: "Southwest Business Systems",
      content: "Smart dispatch scheduling has revolutionized our field service operations. Customer satisfaction is at an all-time high.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                Printyx
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#tools" className="text-gray-600 hover:text-blue-600 transition-colors">Tools</a>
              <a href="#resources" className="text-gray-600 hover:text-blue-600 transition-colors">Resources</a>
              <Button 
                variant="outline" 
                className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                onClick={() => window.location.href = '/login'}
              >
                Login
              </Button>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={() => window.location.href = '/login'}
              >
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between pb-6 border-b">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                        <Printer className="text-white h-5 w-5" />
                      </div>
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                        Printyx
                      </span>
                    </div>
                  </div>
                  
                  <nav className="flex-1 py-6">
                    <div className="space-y-6">
                      <a 
                        href="#features" 
                        className="block text-lg text-gray-900 hover:text-blue-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Features
                      </a>
                      <a 
                        href="#pricing" 
                        className="block text-lg text-gray-900 hover:text-blue-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Pricing
                      </a>
                      <a 
                        href="#tools" 
                        className="block text-lg text-gray-900 hover:text-blue-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Tools
                      </a>
                      <a 
                        href="#resources" 
                        className="block text-lg text-gray-900 hover:text-blue-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Resources
                      </a>
                    </div>
                  </nav>
                  
                  <div className="border-t pt-6 space-y-4">
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
                        setIsMobileMenuOpen(false);
                        window.location.href = '/login';
                      }}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section with 3D Effect */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
        
        {/* 3D Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className={`absolute top-20 left-10 w-32 h-32 bg-blue-500 rounded-full blur-xl transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-20' : 'translate-y-10 opacity-0'}`}></div>
          <div className={`absolute top-40 right-20 w-24 h-24 bg-purple-500 rounded-full blur-xl transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-20' : 'translate-y-10 opacity-0'}`}></div>
          <div className={`absolute bottom-20 left-1/4 w-28 h-28 bg-indigo-500 rounded-full blur-xl transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-20' : 'translate-y-10 opacity-0'}`}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}>
              <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-200">
                Trusted by 4,762+ Copier Dealers
              </Badge>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Unify Your 
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Copier Business</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Replace multiple disconnected systems with one powerful platform. Automate billing, optimize service dispatch, and grow your copier dealership with confidence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg px-8 py-6"
                  onClick={() => window.location.href = '/login'}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 border-gray-300 hover:bg-gray-50"
                >
                  Watch Demo
                </Button>
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  No setup fees
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  30-day free trial
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  Cancel anytime
                </div>
              </div>
            </div>
            
            {/* 3D Animated Dashboard Preview */}
            <div className={`transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative bg-white rounded-2xl shadow-2xl p-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Dashboard Overview</h3>
                      <Badge className="bg-green-100 text-green-800">Live</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Monthly Revenue</p>
                            <p className="text-2xl font-bold text-blue-600">$127K</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-blue-500" />
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Active Contracts</p>
                            <p className="text-2xl font-bold text-green-600">1,247</p>
                          </div>
                          <FileText className="h-8 w-8 text-green-500" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Service Efficiency</p>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full w-4/5"></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">85% completion rate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center transform transition-all duration-700 delay-${index * 100} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Scale Your Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Replace fragmented systems with one unified platform designed specifically for copier dealers
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`transform transition-all duration-700 delay-${index * 100} hover:scale-105 hover:shadow-lg ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              >
                <CardHeader>
                  <div className={`inline-flex items-center justify-center w-12 h-12 ${feature.color} rounded-xl mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4">
                    {feature.description}
                  </CardDescription>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that fits your business size and needs. All plans include a 30-day free trial.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative transform transition-all duration-700 delay-${index * 100} hover:scale-105 hover:shadow-lg ${plan.popular ? 'ring-2 ring-blue-500 shadow-xl' : ''} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600">/{plan.period}</span>
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full mt-6 ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                    onClick={() => window.location.href = '/login'}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">All plans include:</p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                30-day free trial
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                No setup fees
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Cancel anytime
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Data migration included
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Powerful Tools for Every Task
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access industry-specific tools and resources designed to streamline your operations
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12">
            {tools.map((tool, index) => (
              <div 
                key={index} 
                className={`flex items-start space-x-4 transform transition-all duration-700 delay-${index * 100} ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <tool.icon className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{tool.title}</h3>
                  <p className="text-gray-600">{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section id="resources" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Resources & Support
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get the help and resources you need to succeed with comprehensive documentation and support
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {resources.map((category, index) => (
              <div key={index} className={`transform transition-all duration-700 delay-${index * 200} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">{category.category}</h3>
                <div className="space-y-4">
                  {category.items.map((item, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-gray-600">
              See how copier dealers are transforming their operations with Printyx
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className={`transform transition-all duration-700 delay-${index * 200} hover:shadow-lg ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              >
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                    <p className="text-sm text-blue-600">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Copier Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of dealers who've already streamlined their operations with Printyx
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-50 text-lg px-8 py-6"
              onClick={() => window.location.href = '/login'}
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-6"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Printer className="text-white h-5 w-5" />
                </div>
                <span className="text-xl font-bold">Printyx</span>
              </div>
              <p className="text-gray-400">
                The unified platform for copier dealer management, trusted by thousands of businesses worldwide.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#tools" className="hover:text-white transition-colors">Tools</a></li>
                <li><a href="/login" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#resources" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#resources" className="hover:text-white transition-colors">Training</a></li>
                <li><a href="#resources" className="hover:text-white transition-colors">Support</a></li>
                <li><a href="#resources" className="hover:text-white transition-colors">Community</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-gray-400">© 2025 Printyx. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 sm:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;