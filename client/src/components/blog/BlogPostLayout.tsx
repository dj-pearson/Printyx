import { ReactNode } from "react";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BlogPostLayoutProps {
  title: string;
  description: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  children: ReactNode;
}

const BlogPostLayout = ({
  title,
  description,
  author,
  date,
  readTime,
  category,
  children,
}: BlogPostLayoutProps) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/blog'}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Button>
        </div>
      </nav>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12">
          <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-300">
            {category}
          </Badge>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {title}
          </h1>

          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              {author}
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              {date}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {readTime}
            </div>
          </div>
        </header>

        {/* Article Content */}
        <div className="prose prose-lg max-w-none">
          {children}
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">
            Ready to Experience Predictive Intelligence?
          </h3>
          <p className="text-blue-100 mb-6">
            See how Printyx can transform your copier dealership with AI-powered predictive maintenance and intelligent pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
              onClick={() => window.location.href = '/signup'}
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-blue-600"
              onClick={() => window.location.href = '/'}
            >
              Learn More
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
};

export default BlogPostLayout;
