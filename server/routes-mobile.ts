import type { Express } from "express";
import { z } from "zod";
import { 
  insertMobileServiceSessionSchema,
  insertTimeTrackingEntrySchema,
  insertServicePhotoSchema,
  insertLocationHistorySchema,
  type MobileServiceSession,
  type TimeTrackingEntry,
  type ServicePhoto,
  type LocationHistory,
} from "@shared/schema";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// GPS coordinate to address conversion using a free geocoding service
async function coordinatesToAddress(lat: number, lng: number): Promise<string> {
  try {
    // Using OpenStreetMap Nominatim service (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Printyx-Field-Service/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    return data.display_name || `${lat}, ${lng}`;
  } catch (error) {
    console.error('Address lookup failed:', error);
    // Fallback to coordinates if geocoding fails
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

export function registerMobileRoutes(app: Express) {
  const objectStorageService = new ObjectStorageService();

  // Get mobile service sessions for a service ticket
  app.get("/api/mobile/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const { serviceTicketId, technicianId } = req.query;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const sessions = await storage.getMobileServiceSessions({
        tenantId: user.tenantId,
        serviceTicketId,
        technicianId,
      });

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching mobile sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Create a new mobile service session (check-in)
  app.post("/api/mobile/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const sessionData = insertMobileServiceSessionSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      // Convert coordinates to address if provided
      if (sessionData.checkInLatitude && sessionData.checkInLongitude) {
        sessionData.checkInAddress = await coordinatesToAddress(
          Number(sessionData.checkInLatitude),
          Number(sessionData.checkInLongitude)
        );
      }

      const session = await storage.createMobileServiceSession(sessionData);
      
      // Create initial time tracking entry
      if (sessionData.checkInLatitude && sessionData.checkInLongitude) {
        await storage.createTimeTrackingEntry({
          tenantId: user.tenantId,
          sessionId: session.id,
          latitude: sessionData.checkInLatitude,
          longitude: sessionData.checkInLongitude,
          address: sessionData.checkInAddress,
          checkInType: 'arrival',
          timestamp: new Date(),
        });
      }

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating mobile session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Update mobile service session (check-out)
  app.put("/api/mobile/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const updateData = req.body;

      // Convert coordinates to address if provided
      if (updateData.checkOutLatitude && updateData.checkOutLongitude) {
        updateData.checkOutAddress = await coordinatesToAddress(
          Number(updateData.checkOutLatitude),
          Number(updateData.checkOutLongitude)
        );
      }

      // Calculate working hours if both check-in and check-out times are provided
      if (updateData.checkInTimestamp && updateData.checkOutTimestamp) {
        const checkIn = new Date(updateData.checkInTimestamp);
        const checkOut = new Date(updateData.checkOutTimestamp);
        const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        updateData.totalHours = totalHours;
        updateData.workingHours = totalHours - (Number(updateData.breakHours) || 0);
      }

      const session = await storage.updateMobileServiceSession(id, user.tenantId, updateData);
      
      // Create check-out time tracking entry
      if (updateData.checkOutLatitude && updateData.checkOutLongitude) {
        await storage.createTimeTrackingEntry({
          tenantId: user.tenantId,
          sessionId: id,
          latitude: updateData.checkOutLatitude,
          longitude: updateData.checkOutLongitude,
          address: updateData.checkOutAddress,
          checkInType: 'departure',
          timestamp: new Date(),
        });
      }

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error updating mobile session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Create time tracking entry
  app.post("/api/mobile/time-tracking", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const entryData = insertTimeTrackingEntrySchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      // Convert coordinates to address if provided
      if (entryData.latitude && entryData.longitude) {
        entryData.address = await coordinatesToAddress(
          Number(entryData.latitude),
          Number(entryData.longitude)
        );
      }

      const entry = await storage.createTimeTrackingEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating time tracking entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create time tracking entry" });
    }
  });

  // Get time tracking entries for a session
  app.get("/api/mobile/time-tracking", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.query;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const entries = await storage.getTimeTrackingEntries(sessionId, user.tenantId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time tracking entries:", error);
      res.status(500).json({ message: "Failed to fetch time tracking entries" });
    }
  });

  // Get upload URL for service photos
  app.post("/api/mobile/photos/upload", isAuthenticated, async (req: any, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Create service photo record after upload
  app.post("/api/mobile/photos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const photoData = insertServicePhotoSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      // Convert coordinates to address if provided
      if (photoData.latitude && photoData.longitude) {
        photoData.address = await coordinatesToAddress(
          Number(photoData.latitude),
          Number(photoData.longitude)
        );
      }

      // Normalize the object path and set ACL policy
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.objectPath,
        {
          owner: userId,
          visibility: "private", // Service photos are private by default
        }
      );

      photoData.objectPath = normalizedPath;

      const photo = await storage.createServicePhoto(photoData);
      res.status(201).json(photo);
    } catch (error) {
      console.error("Error creating service photo:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create service photo" });
    }
  });

  // Get service photos for a service ticket or session
  app.get("/api/mobile/photos", isAuthenticated, async (req: any, res) => {
    try {
      const { serviceTicketId, sessionId } = req.query;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const photos = await storage.getServicePhotos({
        tenantId: user.tenantId,
        serviceTicketId,
        sessionId,
      });

      res.json(photos);
    } catch (error) {
      console.error("Error fetching service photos:", error);
      res.status(500).json({ message: "Failed to fetch service photos" });
    }
  });

  // Serve service photo files
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: "read" as any,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing photo:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Create location history entry
  app.post("/api/mobile/location-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const locationData = insertLocationHistorySchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      // Convert coordinates to address if provided
      if (locationData.latitude && locationData.longitude) {
        locationData.address = await coordinatesToAddress(
          Number(locationData.latitude),
          Number(locationData.longitude)
        );
      }

      const location = await storage.createLocationHistory(locationData);
      res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location history:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location history" });
    }
  });

  // Get location history for a technician or session
  app.get("/api/mobile/location-history", isAuthenticated, async (req: any, res) => {
    try {
      const { technicianId, sessionId, startDate, endDate } = req.query;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const locations = await storage.getLocationHistory({
        tenantId: user.tenantId,
        technicianId,
        sessionId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json(locations);
    } catch (error) {
      console.error("Error fetching location history:", error);
      res.status(500).json({ message: "Failed to fetch location history" });
    }
  });

  // Reverse geocoding endpoint for mobile apps
  app.post("/api/mobile/geocode", isAuthenticated, async (req: any, res) => {
    try {
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const address = await coordinatesToAddress(Number(latitude), Number(longitude));
      res.json({ address });
    } catch (error) {
      console.error("Error geocoding coordinates:", error);
      res.status(500).json({ message: "Failed to geocode coordinates" });
    }
  });
}