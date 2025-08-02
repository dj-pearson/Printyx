import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  MapPin, 
  Clock, 
  Camera, 
  Play, 
  Square, 
  Users, 
  Wrench,
  CheckCircle,
  XCircle,
  Navigation,
  Timer,
  Image
} from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface MobileServiceSession {
  id: string;
  serviceTicketId: string;
  technicianId: string;
  status: 'scheduled' | 'en_route' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInAddress?: string;
  checkInTimestamp?: string;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutAddress?: string;
  checkOutTimestamp?: string;
  totalHours?: number;
  workingHours?: number;
  breakHours?: number;
  serviceNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServicePhoto {
  id: string;
  fileName: string;
  originalName?: string;
  objectPath: string;
  category?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  takenAt?: string;
  uploadedAt: string;
}

export default function MobileFieldService() {
  const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<MobileServiceSession | null>(null);
  const [serviceNotes, setServiceNotes] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock service ticket ID for demo
  const serviceTicketId = "ticket-123";
  const technicianId = "tech-456";

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError(error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);

  // Fetch active sessions
  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["/api/mobile/sessions", serviceTicketId],
    queryFn: () => apiRequest(`/api/mobile/sessions?serviceTicketId=${serviceTicketId}`),
  });

  // Fetch service photos
  const { data: photos = [] } = useQuery({
    queryKey: ["/api/mobile/photos", serviceTicketId],
    queryFn: () => apiRequest(`/api/mobile/photos?serviceTicketId=${serviceTicketId}`),
  });

  // Create session mutation (check-in)
  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/mobile/sessions", "POST", data);
    },
    onSuccess: (session) => {
      setActiveSession(session);
      refetchSessions();
      toast({
        title: "Checked In",
        description: "Successfully checked in to service location",
      });
    },
    onError: (error) => {
      toast({
        title: "Check-in Failed",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update session mutation (check-out)
  const checkOutMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: string; data: any }) => {
      return apiRequest(`/api/mobile/sessions/${sessionId}`, "PUT", data);
    },
    onSuccess: () => {
      setActiveSession(null);
      refetchSessions();
      toast({
        title: "Checked Out",
        description: "Successfully checked out from service location",
      });
    },
    onError: (error) => {
      toast({
        title: "Check-out Failed",
        description: "Failed to check out. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Photo upload mutation
  const photoMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/mobile/photos", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/photos"] });
      toast({
        title: "Photo Uploaded",
        description: "Service photo uploaded successfully",
      });
    },
  });

  const handleCheckIn = () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location services to check in",
        variant: "destructive",
      });
      return;
    }

    checkInMutation.mutate({
      serviceTicketId,
      technicianId,
      checkInLatitude: currentLocation.latitude.toString(),
      checkInLongitude: currentLocation.longitude.toString(),
      checkInTimestamp: new Date().toISOString(),
      status: 'checked_in',
    });
  };

  const handleCheckOut = () => {
    if (!activeSession || !currentLocation) return;

    checkOutMutation.mutate({
      sessionId: activeSession.id,
      data: {
        checkOutLatitude: currentLocation.latitude.toString(),
        checkOutLongitude: currentLocation.longitude.toString(),
        checkOutTimestamp: new Date().toISOString(),
        status: 'completed',
        serviceNotes,
      },
    });
  };

  const handlePhotoUpload = async () => {
    return {
      method: "PUT" as const,
      url: await apiRequest("/api/mobile/photos/upload", "POST").then(r => r.uploadURL),
    };
  };

  const handlePhotoComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful.length > 0) {
      const upload = result.successful[0];
      
      photoMutation.mutate({
        serviceTicketId,
        sessionId: activeSession?.id,
        fileName: upload.name,
        originalName: upload.name,
        mimeType: upload.type || 'image/jpeg',
        fileSize: upload.size,
        objectPath: upload.uploadURL,
        latitude: currentLocation?.latitude?.toString(),
        longitude: currentLocation?.longitude?.toString(),
        category: 'service',
        description: 'Service documentation photo',
        takenAt: new Date().toISOString(),
      });
    }
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return "In progress...";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const currentSession = sessions.find((s: MobileServiceSession) => 
    s.status === 'checked_in' || s.status === 'in_progress'
  );

  useEffect(() => {
    setActiveSession(currentSession || null);
  }, [currentSession]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mobile Field Service</h1>
          <p className="text-muted-foreground">GPS tracking, time logging, and photo documentation</p>
        </div>
        <Badge variant={activeSession ? "default" : "secondary"}>
          {activeSession ? "On Site" : "Available"}
        </Badge>
      </div>

      {/* Location Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Location Status
          </CardTitle>
          <CardDescription>
            Current GPS location and accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locationError ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span>{locationError}</span>
            </div>
          ) : currentLocation ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Location acquired</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Latitude:</strong> {currentLocation.latitude.toFixed(6)}
                </div>
                <div>
                  <strong>Longitude:</strong> {currentLocation.longitude.toFixed(6)}
                </div>
                {currentLocation.accuracy && (
                  <div className="col-span-2">
                    <strong>Accuracy:</strong> ±{Math.round(currentLocation.accuracy)}m
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <Timer className="h-4 w-4 animate-spin" />
              <span>Acquiring location...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in/Check-out Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
          <CardDescription>
            Check in and out of service locations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSession ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                  <CheckCircle className="h-4 w-4" />
                  Checked in at {activeSession.checkInAddress || "Service location"}
                </div>
                <div className="text-sm text-green-700">
                  Duration: {formatDuration(activeSession.checkInTimestamp || "")}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Notes</label>
                <Textarea
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Document service activities, findings, or recommendations..."
                  rows={4}
                />
              </div>

              <Button
                onClick={handleCheckOut}
                disabled={checkOutMutation.isPending || !currentLocation}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                {checkOutMutation.isPending ? "Checking Out..." : "Check Out"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending || !currentLocation}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {checkInMutation.isPending ? "Checking In..." : "Check In"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Photo Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Photo Documentation
          </CardTitle>
          <CardDescription>
            Upload photos for service documentation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={10485760} // 10MB
            onGetUploadParameters={handlePhotoUpload}
            onComplete={handlePhotoComplete}
            buttonClassName="w-full"
          >
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <span>Upload Service Photos</span>
            </div>
          </ObjectUploader>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo: ServicePhoto) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.objectPath}
                    alt={photo.description || "Service photo"}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs text-center p-2">
                      {photo.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Service Sessions
          </CardTitle>
          <CardDescription>
            History of service visits and time tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No service sessions found
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.slice(0, 5).map((session: MobileServiceSession) => (
                <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={session.status === 'completed' ? 'default' : 
                                session.status === 'checked_in' ? 'secondary' : 'outline'}
                      >
                        {session.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <strong>Location:</strong> {session.checkInAddress || "Unknown location"}
                    </div>
                    {session.workingHours && (
                      <div className="text-sm">
                        <strong>Duration:</strong> {session.workingHours}h
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}