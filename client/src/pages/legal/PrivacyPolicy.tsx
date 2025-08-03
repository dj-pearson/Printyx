import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Eye, Lock, Users, Database, Settings } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          <p className="text-gray-600">Effective Date: January 1, 2025</p>
          <p className="text-gray-600">Last Updated: January 1, 2025</p>
        </div>

        <Card>
          <ScrollArea className="h-[600px]">
            <CardContent className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Eye className="h-5 w-5 mr-2 text-blue-600" />
                  1. INTRODUCTION
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  Printyx LLC ("Company," "we," "us," or "our") is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Printyx software platform and related services ("Platform" or "Services"). This policy applies to all users of our Platform, including copier dealers, their employees, customers, and business partners.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-blue-600" />
                  2. INFORMATION WE COLLECT
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">2.1 Information You Provide</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Account Information:</strong> Name, email address, phone number, company name, job title, and business address</li>
                      <li><strong>Business Data:</strong> Customer records, vendor information, equipment details, service history, contracts, invoices, and financial data</li>
                      <li><strong>Communication Data:</strong> Messages, support tickets, feedback, and correspondence with our team</li>
                      <li><strong>Payment Information:</strong> Billing address and payment method details (processed through secure third-party payment processors)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.2 Information We Collect Automatically</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Usage Data:</strong> Features used, time spent on platform, click patterns, and user interactions</li>
                      <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers, and mobile device information</li>
                      <li><strong>Log Data:</strong> Access times, pages viewed, errors encountered, and system performance metrics</li>
                      <li><strong>Location Data:</strong> General geographic location based on IP address for service optimization</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.3 Information from Third Parties</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Integration Data:</strong> Information from connected services like QuickBooks, Salesforce, E-Automate, ZoomInfo, and Apollo.io</li>
                      <li><strong>Business Intelligence:</strong> Company and contact information from data enrichment services</li>
                      <li><strong>Authentication:</strong> Profile information from Replit authentication services</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-blue-600" />
                  3. HOW WE USE YOUR INFORMATION
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">3.1 Platform Operation</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Provide and maintain the Printyx platform and its features</li>
                      <li>Process transactions and manage billing</li>
                      <li>Enable integrations with third-party business systems</li>
                      <li>Facilitate communication between users and their customers</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.2 Service Improvement</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Analyze usage patterns to improve platform functionality</li>
                      <li>Develop new features and services</li>
                      <li>Troubleshoot technical issues and provide customer support</li>
                      <li>Optimize platform performance and user experience</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.3 Business Operations</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Communicate about service updates, security alerts, and administrative matters</li>
                      <li>Comply with legal obligations and respond to legal requests</li>
                      <li>Protect against fraud, abuse, and security threats</li>
                      <li>Enforce our terms of service and user agreements</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  4. INFORMATION SHARING AND DISCLOSURE
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">4.1 We Do Not Sell Personal Information</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.2 Authorized Sharing</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Service Providers:</strong> Vetted third-party vendors who help us operate our platform (hosting, analytics, customer support)</li>
                      <li><strong>Integrations:</strong> Third-party services you choose to connect (QuickBooks, Salesforce, etc.) per your instructions</li>
                      <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect our rights and safety</li>
                      <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales with appropriate safeguards</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.3 Multi-Tenant Architecture</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Our platform uses a multi-tenant architecture with strict data isolation. Your business data is only accessible to authorized users within your organization and is never shared with other tenants.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Lock className="h-5 w-5 mr-2 text-blue-600" />
                  5. DATA PROTECTION AND SECURITY
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">5.1 Security Measures</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>End-to-end encryption for data in transit and at rest</li>
                      <li>Multi-factor authentication and role-based access controls</li>
                      <li>Regular security audits and vulnerability assessments</li>
                      <li>SOC 2 Type II compliance and industry-standard security frameworks</li>
                      <li>Secure data centers with physical and network security measures</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.2 Data Retention</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We retain your information for as long as necessary to provide our services and comply with legal obligations. Business data is retained according to your subscription terms, with options for data export upon termination.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.3 Data Backup and Recovery</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We maintain regular backups of your data and have disaster recovery procedures in place to ensure business continuity and data availability.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">6. YOUR PRIVACY RIGHTS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">6.1 Access and Control</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Access and review your personal information</li>
                      <li>Update or correct inaccurate information</li>
                      <li>Delete or deactivate your account</li>
                      <li>Export your business data in standard formats</li>
                      <li>Restrict or object to certain processing activities</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.2 Additional Rights (EU/UK Residents)</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Right to data portability</li>
                      <li>Right to withdraw consent</li>
                      <li>Right to lodge complaints with supervisory authorities</li>
                      <li>Rights regarding automated decision-making</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.3 California Residents (CCPA)</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Right to know what personal information is collected</li>
                      <li>Right to delete personal information</li>
                      <li>Right to opt-out of sale (we don't sell personal information)</li>
                      <li>Right to non-discrimination for exercising privacy rights</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">7. INTERNATIONAL DATA TRANSFERS</h2>
                <p className="text-gray-700 leading-relaxed">
                  Our platform may process data in multiple jurisdictions to provide optimal performance. We implement appropriate safeguards for international data transfers, including Standard Contractual Clauses and adequacy decisions where applicable. We ensure that your data receives adequate protection regardless of where it is processed.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">8. COOKIES AND TRACKING TECHNOLOGIES</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">8.1 Types of Cookies</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Essential Cookies:</strong> Required for platform functionality and security</li>
                      <li><strong>Analytics Cookies:</strong> Help us understand usage patterns and improve services</li>
                      <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">8.2 Cookie Management</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You can control cookie settings through your browser preferences. Disabling certain cookies may limit platform functionality.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">9. THIRD-PARTY INTEGRATIONS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">9.1 Integrated Services</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Our platform integrates with various third-party services including QuickBooks, Salesforce, E-Automate, ZoomInfo, and Apollo.io. Each integration is subject to the respective service's privacy policy and terms of use.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">9.2 Data Sharing with Integrations</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We only share data with integrated services that you explicitly authorize. You can revoke integration permissions at any time through your account settings.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">10. CHILDREN'S PRIVACY</h2>
                <p className="text-gray-700 leading-relaxed">
                  Our platform is designed for business use and is not intended for children under 16 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete that information promptly.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">11. CHANGES TO THIS PRIVACY POLICY</h2>
                <p className="text-gray-700 leading-relaxed">
                  We may update this Privacy Policy periodically to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes through email or prominent notices on our platform. Your continued use of our services after such notification constitutes acceptance of the updated policy.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">12. DATA CONTROLLER AND PROCESSOR</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">12.1 Our Role</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Printyx acts as both a data controller (for account and usage information) and data processor (for your business data). We process your business data according to your instructions and applicable data protection agreements.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">12.2 Your Responsibilities</h3>
                    <p className="text-gray-700 leading-relaxed">
                      As a user of our platform, you are responsible for ensuring you have appropriate consent and legal basis for the personal data you process through our services, particularly regarding your customers and business contacts.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-blue-600" />
                  CONTACT US
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:
                </p>
                <div className="space-y-2">
                  <p className="text-gray-700"><strong>Email:</strong> privacy@printyx.com</p>
                  <p className="text-gray-700"><strong>Data Protection Officer:</strong> dpo@printyx.com</p>
                  <p className="text-gray-700"><strong>Address:</strong> Printyx LLC, Privacy Department</p>
                  <p className="text-gray-700"><strong>Phone:</strong> 1-800-PRINTYX</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  We will respond to your privacy-related inquiries within 30 days or as required by applicable law.
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}