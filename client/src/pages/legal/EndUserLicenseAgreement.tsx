import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function EndUserLicenseAgreement() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">End User License Agreement</h1>
          <p className="text-gray-600">Effective Date: January 1, 2025</p>
          <p className="text-gray-600">Last Updated: January 1, 2025</p>
        </div>

        <Card>
          <ScrollArea className="h-[600px]">
            <CardContent className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">1. ACCEPTANCE OF TERMS</h2>
                <p className="text-gray-700 leading-relaxed">
                  This End User License Agreement ("Agreement") is a legal agreement between you ("User," "you," or "your") and Printyx LLC ("Company," "we," "us," or "our") for the use of the Printyx software platform and related services ("Software" or "Platform"). By accessing, downloading, installing, or using the Software, you acknowledge that you have read, understood, and agree to be bound by the terms and conditions of this Agreement.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">2. LICENSE GRANT</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">2.1 Limited License</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Subject to the terms of this Agreement, Company grants you a non-exclusive, non-transferable, revocable license to use the Software solely for your internal business operations as a copier dealer, distributor, or related business entity.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.2 Authorized Users</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You may permit your employees, contractors, and authorized representatives to use the Software on your behalf, provided they comply with this Agreement. You are responsible for ensuring all authorized users comply with these terms.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">2.3 Multi-Tenant Access</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The Software operates on a multi-tenant architecture. Your license grants access to your designated tenant environment only. You may not access, attempt to access, or interfere with other tenant environments.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">3. RESTRICTIONS</h2>
                <div className="space-y-2">
                  <p className="text-gray-700">You may not:</p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Copy, modify, adapt, or create derivative works of the Software</li>
                    <li>Reverse engineer, decompile, disassemble, or attempt to derive source code</li>
                    <li>Distribute, sell, lease, rent, or sublicense the Software to third parties</li>
                    <li>Remove or alter any proprietary notices, labels, or marks on the Software</li>
                    <li>Use the Software for any unlawful purpose or in violation of applicable laws</li>
                    <li>Interfere with or disrupt the Software's functionality or security measures</li>
                    <li>Access or use the Software to build a competitive product or service</li>
                    <li>Exceed the usage limits specified in your subscription plan</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">4. INTELLECTUAL PROPERTY RIGHTS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">4.1 Company Rights</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The Software, including all intellectual property rights therein, is and remains the exclusive property of Company and its licensors. This Agreement does not grant you any ownership rights in the Software.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.2 Your Data</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You retain ownership of all data, content, and information you input into the Software ("Customer Data"). Company will handle Customer Data in accordance with our Privacy Policy and applicable data protection laws.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">4.3 Feedback</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Any suggestions, feedback, or improvements you provide regarding the Software may be used by Company without restriction or compensation to you.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">5. DATA SECURITY AND COMPLIANCE</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">5.1 Security Measures</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Company implements industry-standard security measures to protect your data, including encryption, access controls, and regular security assessments. However, no system is completely secure, and you acknowledge the inherent risks of electronic data transmission.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">5.2 Compliance</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You are responsible for ensuring your use of the Software complies with applicable laws, regulations, and industry standards, including but not limited to data protection, privacy, and financial regulations.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">6. THIRD-PARTY INTEGRATIONS</h2>
                <p className="text-gray-700 leading-relaxed">
                  The Software may integrate with third-party services including but not limited to QuickBooks, Salesforce, E-Automate, ZoomInfo, and Apollo.io. Your use of these integrations is subject to the respective third-party terms of service and privacy policies. Company is not responsible for third-party services' availability, functionality, or data handling practices.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">7. SUBSCRIPTION AND PAYMENT TERMS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">7.1 Subscription Plans</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Access to the Software is provided on a subscription basis. Subscription terms, features, and pricing are specified in your subscription agreement or order form.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">7.2 Payment Obligations</h3>
                    <p className="text-gray-700 leading-relaxed">
                      You agree to pay all applicable fees as specified in your subscription plan. Fees are non-refundable except as expressly provided in your subscription agreement.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">8. TERMINATION</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">8.1 Termination Rights</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Either party may terminate this Agreement with written notice. Company may immediately terminate or suspend your access if you breach this Agreement or fail to pay applicable fees.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">8.2 Effect of Termination</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Upon termination, your right to use the Software immediately ceases. Company will provide reasonable assistance for data export within 30 days of termination, after which your data may be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">9. DISCLAIMER OF WARRANTIES</h2>
                <p className="text-gray-700 leading-relaxed">
                  THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. COMPANY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. COMPANY DOES NOT WARRANT THAT THE SOFTWARE WILL BE ERROR-FREE, UNINTERRUPTED, OR COMPLETELY SECURE.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">10. LIMITATION OF LIABILITY</h2>
                <p className="text-gray-700 leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMPANY'S LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY YOU FOR THE SOFTWARE IN THE TWELVE MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL COMPANY BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS OR DATA.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">11. INDEMNIFICATION</h2>
                <p className="text-gray-700 leading-relaxed">
                  You agree to indemnify and hold harmless Company from any claims, damages, or expenses arising from your use of the Software, violation of this Agreement, or infringement of third-party rights through your use of the Software.
                </p>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">12. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">12.1 Governing Law</h3>
                    <p className="text-gray-700 leading-relaxed">
                      This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">12.2 Dispute Resolution</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Any disputes arising from this Agreement shall be resolved through binding arbitration in accordance with the Commercial Arbitration Rules of the American Arbitration Association.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="text-xl font-semibold mb-4">13. GENERAL PROVISIONS</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">13.1 Entire Agreement</h3>
                    <p className="text-gray-700 leading-relaxed">
                      This Agreement, together with your subscription agreement and our Privacy Policy, constitutes the entire agreement between the parties and supersedes all prior agreements or understandings.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">13.2 Modifications</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Company may modify this Agreement with reasonable notice. Continued use of the Software after notice constitutes acceptance of the modified terms.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">13.3 Severability</h3>
                    <p className="text-gray-700 leading-relaxed">
                      If any provision of this Agreement is deemed invalid or unenforceable, the remaining provisions shall remain in full force and effect.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-gray-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">CONTACT INFORMATION</h2>
                <p className="text-gray-700 leading-relaxed">
                  For questions about this End User License Agreement, please contact us at:
                </p>
                <div className="mt-4 space-y-1">
                  <p className="text-gray-700">Email: legal@printyx.com</p>
                  <p className="text-gray-700">Address: Printyx LLC, Legal Department</p>
                  <p className="text-gray-700">Phone: 1-800-PRINTYX</p>
                </div>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}