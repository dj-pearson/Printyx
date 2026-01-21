import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Clock, TrendingUp, Code, DollarSign, Printer } from 'lucide-react';

const BlogIndex = () => {
  const blogPosts = [
    {
      slug: 'ai-predictive-maintenance-vs-reactive-service',
      title: 'Why AI-Powered Predictive Maintenance Beats Reactive Service (2025 Guide)',
      description:
        'Discover how modern AI-powered predictive maintenance systems are revolutionizing copier dealer operations, reducing emergency calls by 30-40%, and dramatically improving customer satisfaction.',
      category: 'AI & Technology',
      date: 'January 15, 2025',
      readTime: '12 min read',
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
    },
    {
      slug: 'e-automate-vs-modern-cloud-platforms',
      title: 'E-Automate vs Modern Cloud Platforms: Technical Architecture Comparison',
      description:
        "A comprehensive technical breakdown of why legacy dealer management systems like e-automate can't compete with modern cloud-native platforms—and what it means for your dealership.",
      category: 'Platform Comparison',
      date: 'January 12, 2025',
      readTime: '15 min read',
      icon: Code,
      color: 'from-purple-500 to-purple-600',
    },
    {
      slug: 'dynamic-pricing-ai-copier-dealers',
      title: 'How Copier Dealers Increase Profitability 15-25% with Dynamic Pricing AI',
      description:
        'Discover how AI-powered dynamic pricing helps copier dealers optimize contract pricing, identify underpriced accounts, and automatically maximize margins without losing customers.',
      category: 'Revenue Optimization',
      date: 'January 10, 2025',
      readTime: '14 min read',
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
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
              Insights & Resources
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">The Printyx Blog</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Deep dives into AI-powered dealer management, predictive intelligence, and why modern
              architecture beats legacy systems. Learn how forward-thinking dealers are transforming
              their operations.
            </p>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-1 gap-8">
            {blogPosts.map((post, index) => (
              <Card
                key={index}
                className="hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-400 cursor-pointer"
                onClick={() => (window.location.href = `/blog/${post.slug}`)}
              >
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-[1fr,3fr] gap-6">
                    {/* Icon Section */}
                    <div className="flex items-start justify-center md:justify-start">
                      <div
                        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${post.color} flex items-center justify-center shadow-lg`}
                      >
                        <post.icon className="h-10 w-10 text-white" />
                      </div>
                    </div>

                    {/* Content Section */}
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          {post.category}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-600 gap-4">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {post.date}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {post.readTime}
                          </div>
                        </div>
                      </div>

                      <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
                        {post.title}
                      </h2>

                      <p className="text-gray-700 mb-4 leading-relaxed">{post.description}</p>

                      <Button
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-0"
                      >
                        Read Full Article
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Topics/Categories */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Explore by Topic</h2>
            <p className="text-xl text-gray-600">
              Deep insights into the technologies and strategies transforming copier dealer
              operations
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-all border-2 hover:border-blue-400">
              <CardHeader>
                <CardTitle className="text-lg">AI & Technology</CardTitle>
                <CardDescription>
                  How AI and ML are revolutionizing dealer operations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-all border-2 hover:border-purple-400">
              <CardHeader>
                <CardTitle className="text-lg">Platform Comparison</CardTitle>
                <CardDescription>Modern vs. legacy: architecture and capabilities</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-all border-2 hover:border-green-400">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Optimization</CardTitle>
                <CardDescription>Strategies to maximize profitability and margins</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-all border-2 hover:border-orange-400">
              <CardHeader>
                <CardTitle className="text-lg">Best Practices</CardTitle>
                <CardDescription>Proven workflows and operational excellence</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Experience Predictive Intelligence?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            See how Printyx transforms copier dealer operations with AI-powered predictive
            maintenance, dynamic pricing, and modern cloud architecture.
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
              onClick={() => (window.location.href = '/')}
            >
              Explore Platform
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
                AI-Powered Dealer Management • Predictive vs. Reactive • Modern Cloud Architecture
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogIndex;
