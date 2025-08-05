import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCustomerPortal } from '@/pages/CustomerPortal';
import { AlertCircle, CheckCircle, Upload, X, Calendar, Clock } from 'lucide-react';

interface Equipment {
  id: string;
  serialNumber: string;
  model: string;
  location: string;
}

export const ServiceRequestForm: React.FC = () => {
  const { sessionToken } = useCustomerPortal();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    priority: 'normal',
    equipmentSerialNumber: '',
    equipmentModel: '',
    equipmentLocation: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    preferredDate: '',
    preferredTime: '',
    urgencyNotes: '',
    customerNotes: '',
    attachments: [] as File[]
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await fetch('/api/customer-portal/equipment', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEquipment(data.equipment || []);
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  };

  const handleEquipmentSelect = (serialNumber: string) => {
    const selectedEquipment = equipment.find(eq => eq.serialNumber === serialNumber);
    if (selectedEquipment) {
      setFormData({
        ...formData,
        equipmentSerialNumber: selectedEquipment.serialNumber,
        equipmentModel: selectedEquipment.model,
        equipmentLocation: selectedEquipment.location
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB per file

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        setError(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    const totalFiles = formData.attachments.length + validFiles.length;
    if (totalFiles > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    setFormData({
      ...formData,
      attachments: [...formData.attachments, ...validFiles]
    });
    setError('');
  };

  const removeFile = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData({ ...formData, attachments: newAttachments });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // For demo purposes, we'll simulate file upload URLs
      const attachmentUrls = formData.attachments.map((file, index) => ({
        filename: file.name,
        url: `https://example.com/uploads/${file.name}`,
        size: file.size,
        type: file.type
      }));

      const requestData = {
        ...formData,
        attachments: attachmentUrls,
        preferredDate: formData.preferredDate ? new Date(formData.preferredDate).toISOString() : undefined
      };

      const response = await fetch('/api/customer-portal/service-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        setIsSubmitted(true);
        // Reset form
        setFormData({
          title: '',
          description: '',
          type: '',
          priority: 'normal',
          equipmentSerialNumber: '',
          equipmentModel: '',
          equipmentLocation: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          preferredDate: '',
          preferredTime: '',
          urgencyNotes: '',
          customerNotes: '',
          attachments: []
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to submit service request');
      }
    } catch (error) {
      setError('Failed to submit service request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Service Request Submitted</h3>
              <p className="text-gray-600 mt-2">
                Your service request has been submitted successfully. You'll receive a confirmation 
                email shortly with your request number and next steps.
              </p>
            </div>
            <div className="flex justify-center space-x-3">
              <Button onClick={() => setIsSubmitted(false)}>
                Submit Another Request
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/customer-portal/service-requests'}>
                View My Requests
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Service Request</CardTitle>
        <CardDescription>
          Request service for your equipment or report an issue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Request Details</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Request Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Service Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Preventive Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="supplies">Supplies Issue</SelectItem>
                    <SelectItem value="technical_support">Technical Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide detailed information about the issue or service needed..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="normal">Normal - Standard timeline</SelectItem>
                  <SelectItem value="high">High - Needs attention soon</SelectItem>
                  <SelectItem value="urgent">Urgent - Significant impact</SelectItem>
                  <SelectItem value="emergency">Emergency - Equipment down</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Equipment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Equipment Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="equipment">Equipment</Label>
              <Select value={formData.equipmentSerialNumber} onValueChange={handleEquipmentSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.serialNumber}>
                      {eq.model} - {eq.serialNumber} ({eq.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.equipmentSerialNumber}
                  onChange={(e) => setFormData({ ...formData, equipmentSerialNumber: e.target.value })}
                  placeholder="Equipment serial number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.equipmentModel}
                  onChange={(e) => setFormData({ ...formData, equipmentModel: e.target.value })}
                  placeholder="Equipment model"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.equipmentLocation}
                  onChange={(e) => setFormData({ ...formData, equipmentLocation: e.target.value })}
                  placeholder="Equipment location"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="Your name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email Address</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Scheduling Preferences</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferredDate">Preferred Date</Label>
                <div className="relative">
                  <Input
                    id="preferredDate"
                    type="date"
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="preferredTime">Preferred Time</Label>
                <Select value={formData.preferredTime} onValueChange={(value) => setFormData({ ...formData, preferredTime: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8:00 AM - 12:00 PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12:00 PM - 5:00 PM)</SelectItem>
                    <SelectItem value="anytime">Anytime during business hours</SelectItem>
                    <SelectItem value="after-hours">After hours (additional fees may apply)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgencyNotes">Urgency Notes</Label>
              <Textarea
                id="urgencyNotes"
                value={formData.urgencyNotes}
                onChange={(e) => setFormData({ ...formData, urgencyNotes: e.target.value })}
                placeholder="Explain why this request is urgent (if applicable)..."
                rows={2}
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Attachments</h3>
            
            <div className="space-y-2">
              <Label htmlFor="attachments">Upload Files (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Upload photos or documents related to your request
                </p>
                <input
                  id="attachments"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('attachments')?.click()}
                >
                  Choose Files
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum 5 files, 10MB each. Supported: Images, PDF, Word documents
                </p>
              </div>
            </div>

            {formData.attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files</Label>
                <div className="space-y-2">
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {(file.size / 1024 / 1024).toFixed(1)}MB
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="customerNotes">Additional Notes</Label>
            <Textarea
              id="customerNotes"
              value={formData.customerNotes}
              onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
              placeholder="Any additional information that might be helpful..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  title: '',
                  description: '',
                  type: '',
                  priority: 'normal',
                  equipmentSerialNumber: '',
                  equipmentModel: '',
                  equipmentLocation: '',
                  contactName: '',
                  contactPhone: '',
                  contactEmail: '',
                  preferredDate: '',
                  preferredTime: '',
                  urgencyNotes: '',
                  customerNotes: '',
                  attachments: []
                });
              }}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title || !formData.description || !formData.type || !formData.contactName}
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};