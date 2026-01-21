/**
 * Accessibility Statement Page
 * ADA Compliance & WCAG 2.1 Conformance Declaration
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accessibility,
  Eye,
  Keyboard,
  MousePointer,
  Volume2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';

export default function AccessibilityStatement() {
  useEffect(() => {
    document.title = 'Accessibility Statement | Printyx';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-primary hover:underline">
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 dark:text-gray-400">Accessibility Statement</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8" tabIndex={-1}>
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Accessibility className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Accessibility Statement
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Printyx is committed to ensuring digital accessibility for people with disabilities. We
            continually improve the user experience for everyone and apply relevant accessibility
            standards.
          </p>
        </div>

        {/* Commitment Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
              Our Commitment
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Printyx is committed to providing a website that is accessible to the widest possible
              audience, regardless of technology or ability. We are actively working to increase the
              accessibility and usability of our platform and in doing so adhere to many of the
              available standards and guidelines.
            </p>
            <p>
              This website endeavors to conform to level AA of the World Wide Web Consortium (W3C)
              Web Content Accessibility Guidelines 2.1. These guidelines explain how to make web
              content more accessible for people with disabilities and more user-friendly for
              everyone.
            </p>
          </CardContent>
        </Card>

        {/* Conformance Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" aria-hidden="true" />
              Conformance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle
                  className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    WCAG 2.1 Level AA
                  </h3>
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    Printyx substantially conforms to WCAG 2.1 Level AA. Substantially conformant
                    means that the content substantially conforms to the accessibility standard.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CheckCircle
                  className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Section 508 Compliance
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    Our platform is designed to meet the requirements of Section 508 of the
                    Rehabilitation Act, ensuring accessibility for federal agencies and contractors.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <CheckCircle
                  className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                    ADA Compliance
                  </h3>
                  <p className="text-purple-800 dark:text-purple-200 text-sm">
                    Printyx complies with the Americans with Disabilities Act (ADA) Title III
                    requirements for public accommodations in digital spaces.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Accessibility Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Keyboard
                    className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Keyboard Navigation</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Full keyboard accessibility with logical tab order, skip navigation links, and
                    keyboard shortcuts for common actions.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Eye
                    className="h-5 w-5 text-orange-600 dark:text-orange-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Screen Reader Support</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Compatible with popular screen readers including NVDA, JAWS, VoiceOver, and
                    TalkBack. ARIA labels and live regions for dynamic content.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Visual Accommodations</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    High contrast mode, adjustable font sizes, color blindness filters, and support
                    for browser zoom up to 200%.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <MousePointer
                    className="h-5 w-5 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Motor Accessibility</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Large click targets (44x44px minimum), reduced motion option, and support for
                    alternative input devices.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Volume2
                    className="h-5 w-5 text-purple-600 dark:text-purple-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Audio & Multimedia</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No auto-playing audio or video. Media controls are keyboard accessible. Captions
                    provided where applicable.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <CheckCircle
                    className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Form Accessibility</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    All form fields have associated labels, clear error messages, and helpful
                    instructions. Required fields are clearly indicated.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Known Limitations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              Known Limitations
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>While we strive for full accessibility, some content may have limitations:</p>
            <ul>
              <li>
                <strong>Legacy PDF Documents:</strong> Some older PDF documents may not be fully
                accessible. We are working to remediate these documents.
              </li>
              <li>
                <strong>Third-Party Content:</strong> Some third-party integrations may have varying
                levels of accessibility. We work with vendors to improve accessibility where
                possible.
              </li>
              <li>
                <strong>Complex Charts and Graphs:</strong> Some data visualizations may rely
                primarily on visual presentation. We provide data tables as alternatives.
              </li>
            </ul>
            <p>We are actively working to address these limitations and welcome your feedback.</p>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-indigo-500" aria-hidden="true" />
              Keyboard Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Open Command Palette (Search)</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  Cmd/Ctrl + K
                </kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Show Keyboard Shortcuts</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  ?
                </kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Go to Home</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  G then H
                </kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Go to Customers</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  G then C
                </kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Create New</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  C
                </kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span>Save Form</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                  Cmd/Ctrl + S
                </kbd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Accessibility Settings</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Printyx offers customizable accessibility settings that you can adjust to meet your
              needs. Access these settings through Settings &gt; Accessibility:
            </p>
            <ul>
              <li>
                <strong>High Contrast Mode:</strong> Increases color contrast for better visibility
              </li>
              <li>
                <strong>Reduced Motion:</strong> Disables animations and transitions
              </li>
              <li>
                <strong>Font Size:</strong> Adjustable text size from small to extra-large
              </li>
              <li>
                <strong>Color Blindness Filters:</strong> Support for protanopia, deuteranopia,
                tritanopia, and achromatopsia
              </li>
              <li>
                <strong>Focus Indicators:</strong> Enhanced visible focus outlines
              </li>
              <li>
                <strong>Link Underlines:</strong> Underline all links for easier identification
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* VPAT */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Voluntary Product Accessibility Template (VPAT)</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              A Voluntary Product Accessibility Template (VPAT) is available upon request. The VPAT
              documents how Printyx conforms to Section 508 and WCAG 2.1 standards.
            </p>
            <p>To request a copy of our VPAT, please contact us using the information below.</p>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Feedback and Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              We welcome your feedback on the accessibility of Printyx. Please let us know if you
              encounter accessibility barriers:
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <a
                href="mailto:accessibility@printyx.net"
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Email Us</h3>
                  <p className="text-sm text-primary">accessibility@printyx.net</p>
                </div>
              </a>

              <a
                href="tel:+18005551234"
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Call Us</h3>
                  <p className="text-sm text-green-600">1-800-555-1234</p>
                </div>
              </a>
            </div>

            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              We aim to respond to accessibility feedback within 5 business days.
            </p>
          </CardContent>
        </Card>

        {/* External Resources */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://www.w3.org/WAI/standards-guidelines/wcag/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Web Content Accessibility Guidelines (WCAG) 2.1
                </a>
              </li>
              <li>
                <a
                  href="https://www.section508.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Section 508 Standards
                </a>
              </li>
              <li>
                <a
                  href="https://www.ada.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Americans with Disabilities Act (ADA)
                </a>
              </li>
              <li>
                <a
                  href="https://www.w3.org/WAI/test-evaluate/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  W3C Accessibility Evaluation Resources
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-8">
          <p>This statement was last updated on January 12, 2026.</p>
          <p className="mt-2">We review and update this statement regularly to ensure accuracy.</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Printyx. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/privacy" className="hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-primary">
              Terms of Service
            </Link>
            <Link href="/eula" className="hover:text-primary">
              EULA
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
