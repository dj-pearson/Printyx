import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  FileQuestion,
  Home,
  Users,
  BarChart3,
  FileText,
  Search,
  LifeBuoy,
  ArrowLeft,
} from 'lucide-react';

const quickLinks = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/knowledge-base', label: 'Help Center', icon: LifeBuoy },
];

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8">
          <p className="text-sm font-bold tracking-widest text-primary uppercase mb-4">Printyx</p>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <FileQuestion className="h-10 w-10 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Page not found</h1>
          <p className="text-muted-foreground text-lg">
            Sorry, we couldn't find the page you're looking for. It may have been moved or doesn't
            exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Button asChild size="lg" className="min-h-[48px]">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-[48px]"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Quick Links
              </h2>
            </div>
            <nav aria-label="Quick navigation links">
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Button
                      variant="ghost"
                      asChild
                      className="w-full justify-start min-h-[44px] text-sm"
                    >
                      <Link href={link.href}>
                        <link.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {link.label}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Use{' '}
          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-muted-foreground text-xs font-mono">
            Ctrl+K
          </kbd>{' '}
          to search for any page or feature.
        </p>
      </div>
    </div>
  );
}
