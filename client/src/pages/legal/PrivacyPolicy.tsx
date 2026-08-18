import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Eye, Lock, Users, Database, Settings } from 'lucide-react';

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
          <p className="text-gray-600">Last Updated: July 23, 2026</p>
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
                  Printyx LLC ("Company," "we," "us," or "our") is committed to protecting your
                  privacy and personal information. This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your information when you use our Printyx software
                  platform and related services ("Platform" or "Services"). This policy applies to
                  all users of our Platform, including copier dealers, their employees, customers,
                  and business partners.
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
                      <li>
                        <strong>Account Information:</strong> Name, email address, phone number,
                        company name, job title, and business address
                      </li>
                      <li>
                        <strong>Business Data:</strong> Customer records, vendor information,
                        equipment details, service history, contracts, invoices, and financial data
                      </li>
                      <li>
                        <strong>Communication Data:</strong> Messages, support tickets, feedback,
                        and correspondence with our team
                      </li>
                      <li>
                        <strong>Payment Information:</strong> Billing address and payment method
                        details (processed through secure third-party payment processors)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.2 Information We Collect Automatically</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Usage Data:</strong> Features used, time spent on platform, click
                        patterns, and user interactions
                      </li>
                      <li>
                        <strong>Device Information:</strong> IP address, browser type, operating
                        system, device identifiers, and mobile device information
                      </li>
                      <li>
                        <strong>Log Data:</strong> Access times, pages viewed, errors encountered,
                        and system performance metrics
                      </li>
                      <li>
                        <strong>Location Data:</strong> General geographic location based on IP
                        address for service optimization
                      </li>
                      <li>
                        <strong>Error and Performance Data:</strong> When the application fails we
                        receive the error, its technical context, and the page it happened on,
                        through our error-reporting provider (Sentry). We treat this as strictly
                        necessary to keep the service secure and available, so it is not tied to
                        your cookie choices. Performance tracing and session replay are separate,
                        are covered by the analytics category, and are not loaded unless you allow
                        analytics cookies. Replay masks text and form inputs and blocks media before
                        anything leaves your browser. See our{' '}
                        <a href="/cookies" className="text-blue-600 underline">
                          Cookie Policy
                        </a>
                        .
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.3 Information from Third Parties</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Integration Data:</strong> Information from connected services like
                        QuickBooks, Salesforce, E-Automate, ZoomInfo, and Apollo.io
                      </li>
                      <li>
                        <strong>Business Intelligence:</strong> Company and contact information from
                        data enrichment services
                      </li>
                      <li>
                        <strong>Authentication:</strong> Profile information from our authentication
                        provider (Supabase) when you sign in
                      </li>
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
                      <li>
                        Communicate about service updates, security alerts, and administrative
                        matters
                      </li>
                      <li>Comply with legal obligations and respond to legal requests</li>
                      <li>Protect against fraud, abuse, and security threats</li>
                      <li>Enforce our terms of service and user agreements</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.4 Legal Basis for Processing (EU/UK)</h3>
                    <p className="text-gray-700 leading-relaxed mb-2">
                      Where the GDPR or UK GDPR applies, we process personal data on one or more of
                      the following legal bases:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Contract (Art. 6(1)(b)):</strong> to provide the Platform and
                        perform our agreement with you.
                      </li>
                      <li>
                        <strong>Legitimate interests (Art. 6(1)(f)):</strong> to secure, maintain,
                        and improve the Platform, prevent fraud and abuse, and for direct business
                        communications — balanced against your rights.
                      </li>
                      <li>
                        <strong>Consent (Art. 6(1)(a)):</strong> for non-essential cookies,
                        analytics, and marketing communications, which you may withdraw at any time.
                      </li>
                      <li>
                        <strong>Legal obligation (Art. 6(1)(c)):</strong> to comply with tax,
                        accounting, and other legal requirements.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">
                      3.5 Automated Decision-Making and Profiling
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      Some features (such as lead scoring and predictive service insights) use
                      automated processing to generate recommendations. These are decision-support
                      tools: they inform, but do not solely make, decisions that produce legal or
                      similarly significant effects on an individual. We do not carry out automated
                      decision-making within the meaning of Article 22 GDPR without a lawful basis
                      and appropriate safeguards, and you may contact us to request human review of
                      a decision that significantly affects you.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.6 Recorded Meetings and Calls</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Where the platform is used to record a meeting or a service call, everyone on
                      the call must be told and must agree before recording starts. Many US states
                      require the agreement of every party, not just the person doing the recording.
                      The platform will not accept a recording unless the person uploading it
                      records how consent was obtained and from whom, and that record is kept
                      alongside the recording so it can be produced later. Recordings and their
                      transcripts are retained for two years unless deleted sooner, and are removed
                      when a participant exercises their right to erasure. If you did not agree to
                      being recorded, contact the company that organized the meeting, or{' '}
                      <a href="mailto:privacy@printyx.net" className="text-blue-600 underline">
                        privacy@printyx.net
                      </a>
                      .
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">
                      3.7 AI Processing and Third-Party AI Providers
                    </h3>
                    <p className="text-gray-700 leading-relaxed mb-2">
                      Several features send your content to third-party AI providers to be
                      processed. This is worth stating plainly, because it means the content leaves
                      our systems:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Recorded calls and meetings (OpenAI):</strong> where you record a
                        service call or a meeting, the audio is sent to OpenAI to be transcribed.
                        The recording of the conversation itself leaves our systems.
                      </li>
                      <li>
                        <strong>Knowledge search (OpenAI):</strong> knowledge-base content is sent
                        to OpenAI to generate the embeddings that make it searchable.
                      </li>
                      <li>
                        <strong>Imported files (Anthropic):</strong> when AI-assisted import cleanup
                        is used, the contents of the file you upload are sent to Anthropic.
                      </li>
                      <li>
                        <strong>Business reviews and in-product assistants (Anthropic):</strong> the
                        fleet, usage and service data summarized in a quarterly business review, and
                        the questions and context you put to an in-product assistant, are sent to
                        Anthropic.
                      </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      Both providers are listed on our{' '}
                      <a href="/subprocessors" className="text-blue-600 underline">
                        Subprocessors
                      </a>{' '}
                      page with the data categories involved, and both process data in the United
                      States. Whether your data may be used to train their models is governed by the
                      commercial terms in force between Printyx and each provider; contact{' '}
                      <a href="mailto:privacy@printyx.net" className="text-blue-600 underline">
                        privacy@printyx.net
                      </a>{' '}
                      for the current position before relying on it.
                    </p>
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
                      We do not sell, rent, or trade your personal information to third parties for
                      their marketing purposes.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.2 Authorized Sharing</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Service Providers:</strong> Vetted third-party vendors who help us
                        operate our platform (hosting, analytics, customer support)
                      </li>
                      <li>
                        <strong>Integrations:</strong> Third-party services you choose to connect
                        (QuickBooks, Salesforce, etc.) per your instructions
                      </li>
                      <li>
                        <strong>Legal Requirements:</strong> When required by law, court order, or
                        to protect our rights and safety
                      </li>
                      <li>
                        <strong>Business Transfers:</strong> In connection with mergers,
                        acquisitions, or asset sales with appropriate safeguards
                      </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      The service providers that process personal data on our behalf are listed on
                      our{' '}
                      <a href="/subprocessors" className="text-blue-600 underline">
                        Subprocessors
                      </a>{' '}
                      page.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.3 Multi-Tenant Architecture</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Our platform uses a multi-tenant architecture with strict data isolation. Your
                      business data is only accessible to authorized users within your organization
                      and is never shared with other tenants.
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
                      <li>Row-level security enforcing tenant isolation on every query</li>
                      <li>Secure data centers with physical and network security measures</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.2 Data Retention</h3>
                    <p className="text-gray-700 leading-relaxed mb-2">
                      We retain personal data only for as long as necessary for the purposes it was
                      collected, and to meet legal, tax, and accounting obligations. Our typical
                      retention periods are:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Account &amp; business data:</strong> for the life of your
                        subscription and up to 30 days after termination, during which you may
                        export your data, after which it is deleted or anonymized.
                      </li>
                      <li>
                        <strong>Invoices &amp; financial records:</strong> up to 7 years, as
                        required by tax and accounting law.
                      </li>
                      <li>
                        <strong>Security &amp; audit logs:</strong> up to 7 years for security and
                        legal-defense purposes.
                      </li>
                      <li>
                        <strong>Support communications:</strong> up to 3 years after the
                        interaction.
                      </li>
                      <li>
                        <strong>Marketing/analytics data and cookies:</strong> per your consent and
                        the durations described in our{' '}
                        <a href="/cookies" className="text-blue-600 underline">
                          Cookie Policy
                        </a>
                        .
                      </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      Where we are required to retain records that contain personal data, we
                      anonymize the personal identifiers where feasible rather than retain
                      identifiable data.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.3 Data Backup and Recovery</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We maintain regular backups of your data and have disaster recovery procedures
                      in place to ensure business continuity and data availability.
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
                    <p className="text-gray-700 leading-relaxed mt-2">
                      Signed-in users can export their data and delete (anonymize) their account
                      directly under Settings &gt; Data. To exercise any right, you can also email{' '}
                      <a href="mailto:privacy@printyx.net" className="text-blue-600 underline">
                        privacy@printyx.net
                      </a>
                      . We respond within 30 days (or as required by law) and do not discriminate
                      against you for exercising your rights.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.2 Additional Rights (EU/UK Residents)</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Right to data portability</li>
                      <li>Right to withdraw consent</li>
                      <li>Right to lodge complaints with supervisory authorities</li>
                      <li>Rights regarding automated decision-making</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      You may lodge a complaint with your local supervisory authority. In the UK
                      this is the Information Commissioner&apos;s Office (ICO,{' '}
                      <a
                        href="https://ico.org.uk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        ico.org.uk
                      </a>
                      ); in the EU it is the data protection authority in your country of residence.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.3 California Residents (CCPA/CPRA)</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Right to know what personal information is collected</li>
                      <li>Right to delete personal information</li>
                      <li>
                        Right to opt-out of the sale or sharing of personal information — see our{' '}
                        <a href="/do-not-sell" className="text-blue-600 underline">
                          Do Not Sell or Share My Personal Information
                        </a>{' '}
                        page. We do not sell personal information for money, and we honor the Global
                        Privacy Control (GPC) signal.
                      </li>
                      <li>Right to correct inaccurate personal information</li>
                      <li>Right to limit the use of sensitive personal information</li>
                      <li>Right to non-discrimination for exercising privacy rights</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      <strong>Sensitive personal information:</strong> we do not use or disclose
                      sensitive personal information (as defined by the CPRA) for purposes other
                      than those permitted without a right to limit, and we do not sell or share it.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">7. INTERNATIONAL DATA TRANSFERS</h2>
                <p className="text-gray-700 leading-relaxed">
                  Our platform may process data in multiple jurisdictions to provide optimal
                  performance. We implement appropriate safeguards for international data transfers,
                  including Standard Contractual Clauses and adequacy decisions where applicable. We
                  ensure that your data receives adequate protection regardless of where it is
                  processed.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">8. COOKIES AND TRACKING TECHNOLOGIES</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">8.1 Types of Cookies</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>
                        <strong>Essential Cookies:</strong> Required for platform functionality and
                        security
                      </li>
                      <li>
                        <strong>Analytics Cookies:</strong> Help us understand usage patterns and
                        improve services
                      </li>
                      <li>
                        <strong>Preference Cookies:</strong> Remember your settings and preferences
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">8.2 Cookie Management</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Non-essential cookies are set only with your consent. You can review and
                      change your choices at any time through the &quot;Cookie Settings&quot;
                      control in our footer, or through your browser preferences. Disabling certain
                      cookies may limit platform functionality. For full details, including cookie
                      categories and durations, see our{' '}
                      <a href="/cookies" className="text-blue-600 underline">
                        Cookie Policy
                      </a>
                      .
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
                      Our platform integrates with various third-party services including
                      QuickBooks, Salesforce, E-Automate, ZoomInfo, and Apollo.io. Each integration
                      is subject to the respective service's privacy policy and terms of use.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">9.2 Data Sharing with Integrations</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We only share data with integrated services that you explicitly authorize. You
                      can revoke integration permissions at any time through your account settings.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">10. CHILDREN'S PRIVACY</h2>
                <p className="text-gray-700 leading-relaxed">
                  Our platform is designed for business use and is not intended for children under
                  16 years of age. We do not knowingly collect personal information from children.
                  If we become aware that we have collected information from a child, we will take
                  steps to delete that information promptly.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">11. CHANGES TO THIS PRIVACY POLICY</h2>
                <p className="text-gray-700 leading-relaxed">
                  We may update this Privacy Policy periodically to reflect changes in our
                  practices, technology, legal requirements, or other factors. We will notify you of
                  material changes through email or prominent notices on our platform. Your
                  continued use of our services after such notification constitutes acceptance of
                  the updated policy.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">12. DATA CONTROLLER AND PROCESSOR</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">12.1 Our Role</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Printyx acts as both a data controller (for account and usage information) and
                      data processor (for your business data). When we process personal data on your
                      behalf as a processor, our{' '}
                      <a href="/dpa" className="text-blue-600 underline">
                        Data Processing Agreement
                      </a>{' '}
                      governs that processing.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">12.2 Your Responsibilities</h3>
                    <p className="text-gray-700 leading-relaxed">
                      As a user of our platform, you are responsible for ensuring you have
                      appropriate consent and legal basis for the personal data you process through
                      our services, particularly regarding your customers and business contacts.
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
                  If you have questions about this Privacy Policy or wish to exercise your privacy
                  rights, please contact us:
                </p>
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <strong>Email:</strong> privacy@printyx.net
                  </p>
                  <p className="text-gray-700">
                    <strong>Data Protection Officer:</strong> dpo@printyx.net
                  </p>
                  <p className="text-gray-700">
                    <strong>Entity:</strong> Printyx LLC (Privacy Department). Our registered
                    mailing address is available on request.
                  </p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  We will respond to your privacy-related inquiries within 30 days or as required by
                  applicable law.
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
