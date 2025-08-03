import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Scale, AlertTriangle, Users, CreditCard, Shield } from "lucide-react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Scale className="h-8 w-8 text-green-600 mr-2" />
            <h1 className="text-3xl font-bold text-gray-900">Terms and Conditions</h1>
          </div>
          <p className="text-gray-600">Effective Date: January 1, 2025</p>
          <p className="text-gray-600">Last Updated: January 1, 2025</p>
        </div>

        <Card>
          <ScrollArea className="h-[600px]">
            <CardContent className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-green-600" />
                  1. ACCEPTANCE OF TERMS
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  These Terms and Conditions ("Terms," "Agreement") govern your use of the Printyx software platform and related services ("Platform," "Services") provided by Printyx LLC ("Company," "we," "us," or "our"). By accessing or using our Platform, you ("User," "Customer," "you") agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use our Platform.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-600" />
                  2. PLATFORM DESCRIPTION
                </h2>
                <div className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">
                    Printyx is a comprehensive business management platform designed specifically for copier dealers, distributors, and related businesses. Our Platform provides:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Customer Relationship Management (CRM) and lead tracking</li>
                    <li>Service dispatch and field service management</li>
                    <li>Inventory management and equipment lifecycle tracking</li>
                    <li>Financial management and billing automation</li>
                    <li>Integration with third-party business systems</li>
                    <li>Multi-location and multi-tenant architecture</li>
                    <li>Mobile field service capabilities</li>
                    <li>Advanced reporting and analytics</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">3. ACCOUNT REGISTRATION AND ELIGIBILITY</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">3.1 Eligibility</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You must be at least 18 years old and have the legal capacity to enter into this Agreement. Our Platform is intended for business use by copier dealers, distributors, and related commercial entities.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.2 Account Registration</h3>
                    <p className="text-gray-700 leading-relaxed">
                      To access our Platform, you must create an account by providing accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">3.3 Account Security</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You must immediately notify us of any unauthorized use of your account or any security breach. We reserve the right to suspend or terminate accounts that violate security protocols.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-green-600" />
                  4. SUBSCRIPTION AND PAYMENT TERMS
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">4.1 Subscription Plans</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Our Platform is offered on a subscription basis with various plans and pricing tiers. Specific terms, features, and pricing are detailed in your subscription agreement or order form.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.2 Payment Obligations</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Subscription fees are payable in advance on a monthly or annual basis</li>
                      <li>All fees are non-refundable unless expressly stated otherwise</li>
                      <li>You authorize us to charge your designated payment method</li>
                      <li>Failed payments may result in service suspension or termination</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.3 Price Changes</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We may modify subscription pricing with 30 days' written notice. Price changes will take effect at your next renewal period.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.4 Taxes</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You are responsible for all applicable taxes, duties, and government-imposed fees related to your use of our Platform.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">5. ACCEPTABLE USE POLICY</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">5.1 Permitted Use</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You may use our Platform solely for legitimate business purposes related to copier dealer operations, in compliance with all applicable laws and these Terms.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.2 Prohibited Activities</h3>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Violating any applicable laws or regulations</li>
                      <li>Infringing on intellectual property rights</li>
                      <li>Transmitting malicious code, viruses, or harmful software</li>
                      <li>Attempting to gain unauthorized access to our systems</li>
                      <li>Interfering with or disrupting Platform functionality</li>
                      <li>Using the Platform for competitive intelligence gathering</li>
                      <li>Sublicensing, reselling, or redistributing access to the Platform</li>
                      <li>Reverse engineering or attempting to extract source code</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.3 Content Standards</h3>
                    <p className="text-gray-700 leading-relaxed">
                      All content you upload or transmit through our Platform must be lawful, accurate, and not infringe on third-party rights. You are solely responsible for your content and its compliance with applicable laws.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">6. DATA OWNERSHIP AND PRIVACY</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">6.1 Your Data</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You retain ownership of all data, content, and information you input into our Platform ("Customer Data"). We will handle Customer Data in accordance with our Privacy Policy and applicable data protection laws.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.2 Data Processing</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We will process Customer Data solely as necessary to provide our Services and as directed by you. We implement appropriate technical and organizational measures to protect your data.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">6.3 Data Export and Deletion</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Upon termination, we will provide reasonable assistance for data export within 30 days. After this period, your data may be permanently deleted from our systems.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">7. THIRD-PARTY INTEGRATIONS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">7.1 Available Integrations</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Our Platform integrates with various third-party services including QuickBooks, Salesforce, E-Automate, ZoomInfo, Apollo.io, and other business systems.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">7.2 Third-Party Terms</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Your use of third-party integrations is subject to the respective third-party terms of service and privacy policies. We are not responsible for third-party services' availability, functionality, or data handling practices.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">7.3 Integration Liability</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We provide integrations "as is" and disclaim responsibility for any issues arising from third-party service disruptions, changes, or data handling.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-600" />
                  8. PLATFORM AVAILABILITY AND SUPPORT
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">8.1 Service Availability</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We strive to maintain high Platform availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or experience outages that temporarily affect service availability.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">8.2 Customer Support</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We provide customer support according to your subscription plan. Support levels, response times, and availability are detailed in your service agreement.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">8.3 Platform Updates</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We may update, modify, or enhance our Platform at any time. Updates may include new features, security improvements, or changes to existing functionality.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">9. INTELLECTUAL PROPERTY RIGHTS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">9.1 Platform Ownership</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The Platform, including all software, technology, content, and intellectual property rights, is owned by Company and protected by copyright, trademark, and other intellectual property laws.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">9.2 Limited License</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We grant you a limited, non-exclusive, non-transferable license to use our Platform solely for your internal business purposes during your subscription term.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">9.3 Feedback and Suggestions</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Any feedback, suggestions, or improvements you provide regarding our Platform may be used by us without restriction or compensation to you.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">10. TERMINATION</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">10.1 Termination by You</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You may terminate your subscription at any time by providing written notice. Termination will be effective at the end of your current billing period.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">10.2 Termination by Us</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We may terminate your access immediately if you breach these Terms, fail to pay fees, or engage in prohibited activities. We may also terminate with 30 days' notice for business reasons.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">10.3 Effect of Termination</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Upon termination, your access to the Platform ceases, outstanding fees become due, and we will provide data export assistance as specified in Section 6.3.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                  11. DISCLAIMERS AND WARRANTIES
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">11.1 Platform Provided "As Is"</h3>
                    <p className="text-gray-700 leading-relaxed">
                      OUR PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">11.2 No Guarantee of Results</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We do not guarantee that our Platform will meet your specific requirements, be error-free, uninterrupted, or completely secure. You acknowledge the inherent limitations of software platforms.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">12. LIMITATION OF LIABILITY</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">12.1 Damages Limitation</h3>
                    <p className="text-gray-700 leading-relaxed">
                      TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO YOUR USE OF OUR PLATFORM SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">12.2 Exclusion of Consequential Damages</h3>
                    <p className="text-gray-700 leading-relaxed">
                      IN NO EVENT SHALL WE BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION, REGARDLESS OF THE THEORY OF LIABILITY.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">13. INDEMNIFICATION</h2>
                <p className="text-gray-700 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless Company, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including attorney fees) arising from your use of our Platform, violation of these Terms, or infringement of third-party rights.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">14. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">14.1 Governing Law</h3>
                    <p className="text-gray-700 leading-relaxed">
                      These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">14.2 Dispute Resolution</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with the Commercial Arbitration Rules of the American Arbitration Association. The arbitration shall take place in Delaware.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">14.3 Class Action Waiver</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You agree to resolve disputes individually and waive the right to participate in class actions or representative proceedings.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">15. GENERAL PROVISIONS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">15.1 Entire Agreement</h3>
                    <p className="text-gray-700 leading-relaxed">
                      These Terms, together with your subscription agreement, Privacy Policy, and any additional terms, constitute the entire agreement between the parties.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">15.2 Modifications</h3>
                    <p className="text-gray-700 leading-relaxed">
                      We may modify these Terms at any time with reasonable notice. Continued use of our Platform after modification constitutes acceptance of the updated Terms.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">15.3 Severability</h3>
                    <p className="text-gray-700 leading-relaxed">
                      If any provision of these Terms is deemed invalid or unenforceable, the remaining provisions shall remain in full force and effect.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">15.4 Assignment</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You may not assign these Terms without our written consent. We may assign these Terms to any affiliate or successor entity.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-green-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Scale className="h-5 w-5 mr-2 text-green-600" />
                  CONTACT INFORMATION
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  For questions about these Terms and Conditions, please contact us:
                </p>
                <div className="space-y-2">
                  <p className="text-gray-700"><strong>Email:</strong> legal@printyx.com</p>
                  <p className="text-gray-700"><strong>Address:</strong> Printyx LLC, Legal Department</p>
                  <p className="text-gray-700"><strong>Phone:</strong> 1-800-PRINTYX</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  By using our Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}