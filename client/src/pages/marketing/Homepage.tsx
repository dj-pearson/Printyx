import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
} from "lucide-react";
import Interactive3DHero from "@/components/marketing/Interactive3DHero";

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
      description:
        "Eliminate manual billing processes with automated meter reading and invoice generation. Save 15+ hours per week on billing operations.",
      color: "bg-blue-500",
      benefits: [
        "95% billing accuracy",
        "Automatic invoice generation",
        "Real-time meter tracking",
      ],
    },
    {
      icon: Calendar,
      title: "Smart Service Dispatch",
      description:
        "Optimize technician scheduling with intelligent routing and availability management. Reduce travel time by 40%.",
      color: "bg-green-500",
      benefits: [
        "GPS-based routing",
        "Real-time scheduling",
        "Mobile technician app",
      ],
    },
    {
      icon: Users,
      title: "Unified CRM System",
      description:
        "Manage customer relationships, leads, and sales pipeline in one integrated platform. Increase sales conversion by 35%.",
      color: "bg-purple-500",
      benefits: ["Lead scoring", "Pipeline tracking", "Customer history"],
    },
    {
      icon: FileText,
      title: "Contract Management",
      description:
        "Track service agreements, lease terms, and billing cycles with automated renewals. Never miss a renewal again.",
      color: "bg-orange-500",
      benefits: [
        "Automated renewals",
        "Contract alerts",
        "Billing integration",
      ],
    },
    {
      icon: Wrench,
      title: "Inventory Management",
      description:
        "Real-time parts tracking, automated reordering, and warehouse management. Reduce inventory costs by 25%.",
      color: "bg-red-500",
      benefits: [
        "Real-time tracking",
        "Automated reordering",
        "Supplier integration",
      ],
    },
    {
      icon: Shield,
      title: "Multi-Tenant Security",
      description:
        "Enterprise-grade security with role-based access control and data isolation. Keep your customer data safe.",
      color: "bg-indigo-500",
      benefits: [
        "Role-based access",
        "Data encryption",
        "Audit trails",
      ],
    },
  ];

  const benefits = [
    {
      icon: BarChart3,
      title: "Reduce operational costs by 40%",
      description: "Automate manual processes and eliminate redundant systems",
    },
    {
      icon: TrendingUp,
      title: "Increase revenue by 25%",
      description: "Better customer retention and upselling opportunities",
    },
    {
      icon: Shield,
      title: "Improve service quality by 60%",
      description: "Faster response times and better technician management",
    },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Owner, TechCopy Solutions",
      content:
        "Printyx has completely transformed how we manage our business. What used to take hours now takes minutes.",
      rating: 5,
    },
    {
      name: "Mike Chen",
      role: "Operations Manager, Copy Pro",
      content:
        "The unified dashboard gives us real-time visibility into every aspect of our operation. Game-changing.",
      rating: 5,
    },
    {
      name: "Lisa Rodriguez",
      role: "Service Director, Office Solutions Inc",
      content:
        "Our technicians love the mobile app, and our customers love the faster service. Win-win.",
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
              <Printer className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                Printyx
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#features"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#benefits"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Benefits
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
                onClick={() => (window.location.href = "/login")}
              >
                Login
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 opacity-75 cursor-not-allowed"
                disabled
              >
                Coming October 1st
              </Button>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <Sheet
                open={isMobileMenuOpen}
                onOpenChange={setIsMobileMenuOpen}
              >
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
                        window.location.href = "/login";
                      }}
                    >
                      Login
                    </Button>
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 opacity-75 cursor-not-allowed"
                      disabled
                    >
                      Coming October 1st
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
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Scale Your Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Replace fragmented systems with one unified platform designed
              specifically for copier dealers
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`transform transition-all duration-700 delay-${
                  index * 100
                } hover:scale-105 hover:shadow-lg ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                <CardHeader>
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 ${feature.color} rounded-xl mb-4`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4">
                    {feature.description}
                  </CardDescription>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
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

      {/* Benefits Section */}
      <section id="benefits" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Copier Dealers Choose Printyx
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join hundreds of dealers who have transformed their operations
              with our unified platform
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className={`text-center transform transition-all duration-700 delay-${
                  index * 200
                } ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-6">
                  <benefit.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {benefit.title}
                </h3>
                <p className="text-lg text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real feedback from copier dealers who have transformed their
              business with Printyx
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className={`transform transition-all duration-700 delay-${
                  index * 150
                } hover:shadow-lg ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-400">
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Join the copier dealers who are already using Printyx to streamline
            their operations and grow their business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 opacity-75 cursor-not-allowed"
              disabled
            >
              Coming October 1st, 2025
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-blue-600 opacity-75 cursor-not-allowed"
              disabled
            >
              Get Early Access
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
              <p className="text-gray-400">
                © 2025 Printyx. All rights reserved.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                The unified platform for copier dealers.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;