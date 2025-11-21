import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import MultipleContactsForm from "@/components/forms/MultipleContactsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function CompanyContacts() {
  const { companyId } = useParams();
  const [, navigate] = useLocation();

  // Get company details
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['/api/companies', companyId],
    enabled: !!companyId,
  });

  // Get existing contacts for this company
  const { data: existingContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/companies', companyId, 'contacts'],
    enabled: !!companyId,
  });

  const handleComplete = () => {
    // Navigate back to CRM or company detail page
    navigate('/crm');
  };

  if (companyLoading || contactsLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!company) {
    return (
      <MainLayout>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Company Not Found</h3>
                <p className="text-gray-600 mb-4">The company you're looking for doesn't exist or you don't have access to it.</p>
                <Link href="/crm">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to CRM
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/crm">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to CRM
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Company Contacts</span>
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {company.name}
            </h1>
            <p className="text-gray-600">
              Manage contacts and key personnel for this company
            </p>
          </div>
        </div>

        {/* Company Summary Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name</label>
                <p className="text-lg font-semibold text-gray-900">{company.name}</p>
              </div>
              {company.industry && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Industry</label>
                  <p className="text-gray-900">{company.industry}</p>
                </div>
              )}
              {company.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-gray-900">{company.phone}</p>
                </div>
              )}
              {company.website && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Website</label>
                  <p className="text-gray-900">
                    <a 
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {company.website}
                    </a>
                  </p>
                </div>
              )}
              {company.address && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-gray-900">{company.address}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Contacts Summary */}
        {existingContacts.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Current Contacts ({existingContacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {existingContacts.map((contact: any) => (
                  <div key={contact.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {contact.salutation && `${contact.salutation} `}
                        {contact.firstName} {contact.lastName}
                      </h4>
                      {contact.isPrimary && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                    )}
                    {contact.department && (
                      <p className="text-sm text-gray-600 mb-2">{contact.department}</p>
                    )}
                    {contact.email && (
                      <p className="text-sm text-blue-600 mb-1">
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </p>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-gray-600">
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Management Form */}
        <MultipleContactsForm
          companyId={companyId!}
          existingContacts={existingContacts}
          onComplete={handleComplete}
        />
      </div>
    </MainLayout>
  );
}