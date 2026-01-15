import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Building2, User, MapPin, Phone, Mail, Plus, Search } from 'lucide-react';
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
      // Ensure response is always an array
      return Array.isArray(response) ? response : [];
    },
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: [`/api/business-records/${selectedCompany?.id}/contacts`],
    enabled: !!selectedCompany?.id,
    queryFn: async () => {
      const response = await apiRequest(
        `/api/business-records/${selectedCompany.id}/contacts`,
        'GET',
      );
      // Ensure response is always an array
      return Array.isArray(response) ? response : [];
    },
  });

  // Filter companies based on search
  const filteredCompanies = companies.filter((company) => {
    const searchLower = companySearchTerm.toLowerCase();
    const companyName = company.companyName || `${company.firstName} ${company.lastName}`;
    return (
      companyName.toLowerCase().includes(searchLower) ||
      company.email?.toLowerCase().includes(searchLower)
    );
  });

  const getCompanyDisplayName = (company: Company) => {
    return company.companyName || `${company.firstName} ${company.lastName}`;
  };

  const getContactDisplayName = (contact: Contact) => {
    return `${contact.firstName} ${contact.lastName}`;
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      onCompanySelect(company);
      onContactSelect(null); // Reset contact when company changes
    }
  };

  const handleContactChange = (contactId: string) => {
    if (contactId === 'no-contact') {
      onContactSelect(null);
    } else {
      const contact = contacts.find((c) => c.id === contactId);
      onContactSelect(contact || null);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Building2 className="h-5 w-5" />
          Company & Contact Information
        </CardTitle>
        <CardDescription className="text-sm">
          Select the company and primary contact for this quote
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Company Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Company *</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={selectedCompany?.id || ''} onValueChange={handleCompanyChange}>
                <SelectTrigger className="min-h-[44px]">
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
                    <div className="p-2 text-center text-muted-foreground">No companies found</div>
                  ) : (
                    filteredCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{getCompanyDisplayName(company)}</div>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] active:scale-[0.98] transition-transform"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                  <DialogDescription>Create a new company record for this quote</DialogDescription>
                </DialogHeader>
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    New company creation functionality would be implemented here
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Selected Company Details */}
        {selectedCompany && (
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedCompany.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedCompany.phone || 'No phone'}</span>
              </div>
              {selectedCompany.address && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="break-words">{selectedCompany.address}</div>
                    {selectedCompany.city && selectedCompany.state && (
                      <div className="break-words">
                        {selectedCompany.city}, {selectedCompany.state} {selectedCompany.zipCode}
                      </div>
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
            <Label className="text-sm font-medium">Primary Contact</Label>
            <Select value={selectedContact?.id || 'no-contact'} onValueChange={handleContactChange}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select a contact...">
                  {selectedContact && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getContactDisplayName(selectedContact)}</span>
                      {selectedContact.title && (
                        <span className="text-muted-foreground text-sm hidden sm:inline truncate">
                          - {selectedContact.title}
                        </span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contactsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading contacts...</div>
                ) : contacts.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground">
                    No contacts found for this company
                  </div>
                ) : (
                  <>
                    <SelectItem value="no-contact">
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
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedContact.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedContact.phone || 'No phone'}</span>
              </div>
              {selectedContact.title && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{selectedContact.title}</span>
                </div>
              )}
              {selectedContact.department && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{selectedContact.department}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Address Section */}
        {selectedCompany && selectedCompany.address && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Billing Address</Label>
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs sm:text-sm min-w-0">
                  <div className="break-words">{selectedCompany.address}</div>
                  {selectedCompany.city && selectedCompany.state && (
                    <div className="break-words">
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
