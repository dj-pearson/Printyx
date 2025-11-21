import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCalendar } from './CalendarProvider';
import { Calendar, Settings, Link, Unlink, CheckCircle, AlertCircle } from 'lucide-react';

export const CalendarSetup: React.FC = () => {
  const { providers, connectProvider, disconnectProvider } = useCalendar();
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'microsoft':
        return '🟦'; // Microsoft blue
      case 'google':
        return '🟩'; // Google green
      case 'outlook':
        return '🟦'; // Outlook blue
      default:
        return '📅';
    }
  };

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const connectedCount = providers.filter(p => p.isConnected).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-medium">Calendar Integration</CardTitle>
            <CardDescription>
              Connect calendar providers for automated event creation
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connectedCount > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
            <Badge variant={connectedCount > 0 ? 'default' : 'secondary'}>
              {connectedCount}/{providers.length} Connected
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getProviderIcon(provider.type)}</span>
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-gray-600">
                      {provider.type.charAt(0).toUpperCase() + provider.type.slice(1)} Calendar
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(provider.isConnected)}>
                    {provider.isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                  
                  {provider.isConnected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectProvider(provider.id)}
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => connectProvider(provider.type)}
                    >
                      <Link className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSetupDialogOpen(true)}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Calendar Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Setup Dialog */}
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calendar Settings</DialogTitle>
            <DialogDescription>
              Configure your calendar integration preferences
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Integration Status</h4>
              <div className="text-sm text-gray-600">
                {connectedCount > 0 
                  ? `${connectedCount} calendar provider${connectedCount > 1 ? 's' : ''} connected`
                  : 'No calendar providers connected'
                }
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Features</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>✓ Automatic event creation for scheduled demos</div>
                <div>✓ Attendee notifications and reminders</div>
                <div>✓ Two-way sync with calendar providers</div>
                <div>✓ Meeting link generation for virtual demos</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Security</h4>
              <div className="text-sm text-gray-600">
                All calendar integrations use secure OAuth 2.0 authentication. 
                Tokens are encrypted and stored securely. You can revoke access at any time.
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setIsSetupDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};