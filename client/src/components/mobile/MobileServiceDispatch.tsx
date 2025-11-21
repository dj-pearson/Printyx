import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Phone, 
  Clock, 
  User, 
  Wrench,
  Camera,
  Navigation,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Package,
  FileText,
  QrCode
} from "lucide-react";
import { useMobileDetection, useMobileScanning } from "@/hooks/useExternalIntegrations";
import { useToast } from "@/hooks/use-toast";

interface ServiceTicket {
  id: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  equipmentModel: string;
  issueDescription: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'assigned' | 'en-route' | 'on-site' | 'in-progress' | 'completed';
  scheduledTime: string;
  estimatedDuration: number;
}

interface MobileServiceDispatchProps {
  technicianId: string;
  className?: string;
}

export function MobileServiceDispatch({ technicianId, className }: MobileServiceDispatchProps) {
  const [activeTicket, setActiveTicket] = useState<ServiceTicket | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('assigned');
  const [timeTracking, setTimeTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [partsUsed, setPartsUsed] = useState<string[]>([]);
  
  const { isMobile, orientation } = useMobileDetection();
  const scanner = useMobileScanning();
  const { toast } = useToast();

  // Mock service ticket data
  useEffect(() => {
    setActiveTicket({
      id: 'ST-2025-001',
      customerName: 'Acme Corporation',
      customerAddress: '123 Business Blvd, Suite 100, Phoenix AZ 85001',
      customerPhone: '(602) 555-0123',
      equipmentModel: 'Canon imageRUNNER ADVANCE DX C5860i',
      issueDescription: 'Paper jam error code E000001-0001, unable to print from tray 2',
      priority: 'high',
      status: 'assigned',
      scheduledTime: '2025-08-13T14:00:00Z',
      estimatedDuration: 90
    });
  }, []);

  const handleStatusUpdate = (newStatus: string) => {
    setCurrentStatus(newStatus);
    
    if (newStatus === 'on-site' && !timeTracking) {
      setTimeTracking(true);
      setStartTime(new Date());
    }
    
    toast({
      title: "Status Updated",
      description: `Ticket status changed to: ${newStatus.replace('-', ' ')}`
    });
  };

  const handleScanPart = async () => {
    try {
      await scanner.startScan('barcode');
      if (scanner.scanResult) {
        setPartsUsed(prev => [...prev, scanner.scanResult]);
        toast({
          title: "Part Scanned",
          description: `Added part: ${scanner.scanResult}`
        });
      }
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to scan barcode. Try manual entry.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'en-route': return 'bg-yellow-100 text-yellow-800';
      case 'on-site': return 'bg-orange-100 text-orange-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!activeTicket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Wrench className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No active service tickets</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with ticket status */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{activeTicket.id}</CardTitle>
            <div className="flex gap-2">
              <Badge className={getPriorityColor(activeTicket.priority)}>
                {activeTicket.priority.toUpperCase()}
              </Badge>
              <Badge className={getStatusColor(currentStatus)}>
                {currentStatus.replace('-', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{activeTicket.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{activeTicket.customerAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <a href={`tel:${activeTicket.customerPhone}`} className="text-sm text-blue-600">
                {activeTicket.customerPhone}
              </a>
            </div>
          </div>

          {/* Equipment and Issue */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{activeTicket.equipmentModel}</span>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              {activeTicket.issueDescription}
            </p>
          </div>

          {/* Time Tracking */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Time Tracking</span>
              <div className="flex items-center gap-2">
                {timeTracking && (
                  <span className="text-sm text-green-600">
                    {startTime && `Started: ${startTime.toLocaleTimeString()}`}
                  </span>
                )}
                <Button
                  size="sm"
                  variant={timeTracking ? "destructive" : "default"}
                  onClick={() => {
                    setTimeTracking(!timeTracking);
                    if (!timeTracking) {
                      setStartTime(new Date());
                    }
                  }}
                >
                  {timeTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {['assigned', 'en-route', 'on-site', 'in-progress', 'completed'].map((status) => (
              <Button
                key={status}
                variant={currentStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusUpdate(status)}
                className="text-xs"
              >
                {status === 'en-route' && <Navigation className="h-3 w-3 mr-1" />}
                {status === 'on-site' && <MapPin className="h-3 w-3 mr-1" />}
                {status === 'in-progress' && <Wrench className="h-3 w-3 mr-1" />}
                {status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {status.replace('-', ' ')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Parts Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Parts & Supplies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {scanner.isSupported ? (
              <Button
                size="sm"
                onClick={handleScanPart}
                disabled={scanner.isScanning}
                className="flex-1"
              >
                <QrCode className={`h-4 w-4 mr-2 ${scanner.isScanning ? 'animate-pulse' : ''}`} />
                {scanner.isScanning ? 'Scanning...' : 'Scan Part'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled className="flex-1">
                Camera Not Available
              </Button>
            )}
            <Button size="sm" variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          </div>

          {partsUsed.length > 0 && (
            <div className="space-y-2">
              <Label>Parts Used:</Label>
              <div className="space-y-1">
                {partsUsed.map((part, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{part}</span>
                    <Button size="sm" variant="ghost" onClick={() => 
                      setPartsUsed(prev => prev.filter((_, i) => i !== index))
                    }>
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Service Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add service notes, observations, or recommendations..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="text-sm"
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline">
              <Camera className="h-4 w-4 mr-2" />
              Add Photo
            </Button>
            <Button size="sm" variant="outline">
              Voice Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Complete Service */}
      <div className="sticky bottom-4">
        <Button
          size="lg"
          className="w-full"
          disabled={currentStatus !== 'in-progress'}
          onClick={() => handleStatusUpdate('completed')}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          Complete Service Call
        </Button>
      </div>
    </div>
  );
}

export default MobileServiceDispatch;