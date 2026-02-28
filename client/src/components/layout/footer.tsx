import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { Linkedin, Twitter } from 'lucide-react';

const footerSections = [
  {
    title: 'Product',
    links: [
      { href: '/p/copier-dealer-crm', label: 'CRM for Copier Dealers' },
      { href: '/p/print-service-dispatch-mobile', label: 'Service Dispatch' },
      { href: '/predictive-intelligence', label: 'Predictive Intelligence' },
      { href: '/dynamic-pricing-engine', label: 'Dynamic Pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/knowledge-base', label: 'Knowledge Base' },
      { href: '/roi-calculator', label: 'ROI Calculator' },
      { href: '/compare-eautomate', label: 'E-Automate Alternative' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/dealer-expertise', label: 'About Us' },
      { href: '/battle-card', label: 'Why Printyx' },
      { href: '/case-studies', label: 'Case Studies' },
      { href: '/demo', label: 'Request a Demo' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/eula', label: 'EULA' },
      { href: '/security', label: 'Security' },
    ],
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background" role="contentinfo">
      <div className="container py-8">
        <nav
          aria-label="Footer navigation"
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8"
        >
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <Separator className="mb-6" />

        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
            <p className="text-sm font-semibold text-foreground">Printyx</p>
            <p className="text-center text-sm text-muted-foreground md:text-left">
              &copy; {currentYear} Printyx. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://linkedin.com/company/printyx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Printyx on LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href="https://twitter.com/printyx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Printyx on X (Twitter)"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs text-muted-foreground">System Status: Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
