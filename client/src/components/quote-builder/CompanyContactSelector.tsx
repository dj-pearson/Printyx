import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Plus,
  Search,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Company {
  id: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  recordType: 'lead' | 'customer';
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  isPrimary?: boolean;
}

interface CompanyContactSelectorProps {
  selectedCompany: Company | null;
  selectedContact: Contact | null;
  onCompanySelect: (company: Company) => void;
  onContactSelect: (contact: Contact | null) => void;
}

export default function CompanyContactSelector({
  selectedCompany,
  selectedContact,
  onCompanySelect,
  onContactSelect,
}: CompanyContactSelectorProps) {
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);

  // Fetch business records (companies/customers)
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/business-records'],
    queryFn: async () => {
      const response = await apiRequest('/api/business-records', 'GET');
      return response;
    },
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: [`/api/business-records/${selectedCompany?.id}/contacts`],
    enabled: !!selectedCompany?.id,
    queryFn: async () => {
      const response = await apiRequest(`/api/business-records/${selectedCompany.id}/contacts`, 'GET');
      return response;
    },
  });

  // Filter companies based on search
  const filteredCompanies = companies.filter((company) => {
    const searchLower = companySearchTerm.toLowerCase();
    const companyName = company.companyName || `${company.firstName} ${company.lastName}`;
    return companyName.toLowerCase().includes(searchLower) ||
           company.email?.toLowerCase().includes(searchLower);
  });

  const getCompanyDisplayName = (company: Company) => {
    return company.companyName || `${company.firstName} ${company.lastName}`;
  };

  const getContactDisplayName = (contact: Contact) => {
    return `${contact.firstName} ${contact.lastName}`;
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      onCompanySelect(company);
      onContactSelect(null); // Reset contact when company changes
    }
  };

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    onContactSelect(contact || null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company & Contact Information
        </CardTitle>
        <CardDescription>
          Select the company and primary contact for this quote
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Selection */}
        <div className="space-y-2">
          <Label>Company *</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                value={selectedCompany?.id || ''}
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company...">
                    {selectedCompany && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {getCompanyDisplayName(selectedCompany)}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search companies..."
                        value={companySearchTerm}
                        onChange={(e) => setCompanySearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  {companiesLoading ? (
                    <div className="p-2 text-center text-muted-foreground">
                      Loading companies...
                    </div>
                  ) : filteredCompanies.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground">
                      No companies found
                    </div>
                  ) : (
                    filteredCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <div>
                            <div className="font-medium">
                              {getCompanyDisplayName(company)}
                            </div>
                            {company.city && company.state && (
                              <div className="text-xs text-muted-foreground">
                                {company.city}, {company.state}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                  <DialogDescription>
                    Create a new company record for this quote
                  </DialogDescription>
                </DialogHeader>
                <div className="text-center p-4">
                  <p className="text-muted-foreground">
                    New company creation functionality would be implemented here
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Selected Company Details */}
        {selectedCompany && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                {selectedCompany.email || 'No email'}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {selectedCompany.phone || 'No phone'}
              </div>
              {selectedCompany.address && (
                <div className="flex items-start gap-2 md:col-span-2">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                  <div>
                    {selectedCompany.address}
                    {selectedCompany.city && selectedCompany.state && (
                      <div>{selectedCompany.city}, {selectedCompany.state} {selectedCompany.zipCode}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Selection */}
        {selectedCompany && (
          <div className="space-y-2">
            <Label>Primary Contact</Label>
            <Select
              value={selectedContact?.id || ''}
              onValueChange={handleContactChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a contact...">
                  {selectedContact && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {getContactDisplayName(selectedContact)}
                      {selectedContact.title && (
                        <span className="text-muted-foreground">
                          - {selectedContact.title}
                        </span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contactsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">
                    Loading contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground">
                    No contacts found for this company
                  </div>
                ) : (
                  <>
                    <SelectItem value="">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        No specific contact
                      </div>
                    </SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">
                              {getContactDisplayName(contact)}
                              {contact.isPrimary && (
                                <span className="ml-2 text-xs bg-primary text-primary-foreground px-1 rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                            {contact.title && (
                              <div className="text-xs text-muted-foreground">
                                {contact.title}
                                {contact.department && ` - ${contact.department}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected Contact Details */}
        {selectedContact && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                {selectedContact.email || 'No email'}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {selectedContact.phone || 'No phone'}
              </div>
              {selectedContact.title && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {selectedContact.title}
                </div>
              )}
              {selectedContact.department && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  {selectedContact.department}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Address Section */}
        {selectedCompany && selectedCompany.address && (
          <div className="space-y-2">
            <Label>Billing Address</Label>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <div>{selectedCompany.address}</div>
                  {selectedCompany.city && selectedCompany.state && (
                    <div>
                      {selectedCompany.city}, {selectedCompany.state} {selectedCompany.zipCode}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}