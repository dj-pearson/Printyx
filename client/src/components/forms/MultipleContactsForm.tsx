import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Contact {
  id?: string;
  salutation?: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

interface MultipleContactsFormProps {
  companyId: string;
  existingContacts?: Contact[];
  onComplete?: () => void;
}

export default function MultipleContactsForm({ 
  companyId, 
  existingContacts = [], 
  onComplete 
}: MultipleContactsFormProps) {
  const [contacts, setContacts] = useState<Contact[]>([
    // Start with existing contacts or one empty contact
    ...existingContacts,
    ...(existingContacts.length === 0 ? [{ firstName: "", lastName: "", email: "", phone: "", title: "", department: "", salutation: "" }] : [])
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveContactsMutation = useMutation({
    mutationFn: async (contactsData: Contact[]) => {
      const response = await fetch(`/api/companies/${companyId}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contacts: contactsData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save contacts');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Contacts saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      onComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save contacts",
        variant: "destructive",
      });
    },
  });

  const addContact = () => {
    setContacts([
      ...contacts,
      { firstName: "", lastName: "", email: "", phone: "", title: "", department: "", salutation: "" }
    ]);
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index));
    }
  };

  const updateContact = (index: number, field: keyof Contact, value: string | boolean) => {
    const updatedContacts = contacts.map((contact, i) => {
      if (i === index) {
        return { ...contact, [field]: value };
      }
      return contact;
    });
    setContacts(updatedContacts);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate contacts
    const validContacts = contacts.filter(contact => 
      contact.firstName.trim() && contact.lastName.trim()
    );

    if (validContacts.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one contact with first and last name is required",
        variant: "destructive",
      });
      return;
    }

    // Set the first contact as primary if none selected
    if (!validContacts.some(contact => contact.isPrimary)) {
      validContacts[0].isPrimary = true;
    }

    saveContactsMutation.mutate(validContacts);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Company Contacts
        </CardTitle>
        <p className="text-sm text-gray-600">
          Add multiple contacts for this company. The first contact will be set as the primary contact.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {contacts.map((contact, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4 relative">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">
                  Contact {index + 1}
                  {contact.isPrimary && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Primary
                    </span>
                  )}
                </h4>
                {contacts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeContact(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Salutation */}
                <div>
                  <Label htmlFor={`salutation-${index}`}>Salutation</Label>
                  <Select 
                    value={contact.salutation || ""} 
                    onValueChange={(value) => updateContact(index, 'salutation', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr.">Mr.</SelectItem>
                      <SelectItem value="Ms.">Ms.</SelectItem>
                      <SelectItem value="Mrs.">Mrs.</SelectItem>
                      <SelectItem value="Dr.">Dr.</SelectItem>
                      <SelectItem value="Prof.">Prof.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* First Name */}
                <div>
                  <Label htmlFor={`firstName-${index}`}>First Name *</Label>
                  <Input
                    id={`firstName-${index}`}
                    value={contact.firstName}
                    onChange={(e) => updateContact(index, 'firstName', e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>

                {/* Last Name */}
                <div>
                  <Label htmlFor={`lastName-${index}`}>Last Name *</Label>
                  <Input
                    id={`lastName-${index}`}
                    value={contact.lastName}
                    onChange={(e) => updateContact(index, 'lastName', e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>

                {/* Title */}
                <div>
                  <Label htmlFor={`title-${index}`}>Title</Label>
                  <Input
                    id={`title-${index}`}
                    value={contact.title || ""}
                    onChange={(e) => updateContact(index, 'title', e.target.value)}
                    placeholder="Manager"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Department */}
                <div>
                  <Label htmlFor={`department-${index}`}>Department</Label>
                  <Select 
                    value={contact.department || ""} 
                    onValueChange={(value) => updateContact(index, 'department', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Executive">Executive</SelectItem>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="HR">Human Resources</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Purchasing">Purchasing</SelectItem>
                      <SelectItem value="Administration">Administration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor={`phone-${index}`}>Phone</Label>
                  <Input
                    id={`phone-${index}`}
                    value={contact.phone || ""}
                    onChange={(e) => updateContact(index, 'phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor={`email-${index}`}>Email</Label>
                  <Input
                    id={`email-${index}`}
                    value={contact.email || ""}
                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                    placeholder="john.smith@company.com"
                    type="email"
                  />
                </div>
              </div>

              {/* Primary Contact Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`primary-${index}`}
                  checked={contact.isPrimary || false}
                  onChange={(e) => {
                    // Only allow one primary contact
                    if (e.target.checked) {
                      const updatedContacts = contacts.map((c, i) => ({
                        ...c,
                        isPrimary: i === index
                      }));
                      setContacts(updatedContacts);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <Label htmlFor={`primary-${index}`} className="text-sm font-medium text-gray-700">
                  Set as primary contact
                </Label>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="outline" 
              onClick={addContact}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Contact
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onComplete}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveContactsMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saveContactsMutation.isPending ? "Saving..." : "Save Contacts"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}