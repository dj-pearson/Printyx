import { storage } from '../storage';
import { RouteAssignment, InsertRouteAssignment } from '@shared/gps-tracking-schema';

// Haversine formula for accurate distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Average driving speed in m/s (approximately 40 km/h in urban areas)
const AVERAGE_SPEED_MS = 11.11;

// Service time per stop in minutes
const DEFAULT_SERVICE_TIME_MINUTES = 45;

export interface Waypoint {
  ticketId: string;
  customerId?: string;
  address: string;
  lat: number;
  lng: number;
  sequence: number;
  estimatedArrival?: Date;
  estimatedDeparture?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority?: number; // 1 = highest priority
  scheduledTime?: Date; // If customer has specific time window
  serviceTimeMinutes?: number;
}

export interface OptimizedRoute {
  waypoints: Waypoint[];
  totalDistance: number; // meters
  estimatedDuration: number; // minutes
  optimizationAlgorithm: 'nearest_neighbor' | 'priority_based' | 'time_window' | 'balanced';
  savings: {
    distanceSavedMeters: number;
    timeSavedMinutes: number;
    percentageImprovement: number;
  };
}

export interface RouteOptimizationInput {
  tenantId: string;
  technicianId: string;
  startLocation: { lat: number; lng: number; address?: string };
  endLocation?: { lat: number; lng: number; address?: string }; // Optional return to depot
  waypoints: Waypoint[];
  algorithm?: 'nearest_neighbor' | 'priority_based' | 'time_window' | 'balanced';
  respectPriorities?: boolean;
  respectTimeWindows?: boolean;
  maxStopsPerRoute?: number;
}

export interface RouteAnalytics {
  technicianId: string;
  period: { start: Date; end: Date };
  totalRoutes: number;
  totalStops: number;
  totalDistance: number; // meters
  totalDuration: number; // minutes
  averageStopsPerRoute: number;
  averageDistancePerRoute: number;
  averageTimePerStop: number;
  onTimePercentage: number;
  routeEfficiencyScore: number; // 0-100
  mostVisitedAreas: { area: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}

export class RouteOptimizationService {
  /**
   * Optimizes a route using the nearest neighbor algorithm
   * This is a greedy algorithm that always picks the closest unvisited location
   */
  private optimizeNearestNeighbor(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
    endLocation?: { lat: number; lng: number },
  ): Waypoint[] {
    if (waypoints.length <= 1) return waypoints;

    const optimized: Waypoint[] = [];
    const remaining = [...waypoints];
    let currentLocation = startLocation;

    while (remaining.length > 0) {
      // Find nearest unvisited waypoint
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          remaining[i].lat,
          remaining[i].lng,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add nearest to optimized route
      const nearest = remaining.splice(nearestIndex, 1)[0];
      nearest.sequence = optimized.length + 1;
      optimized.push(nearest);
      currentLocation = { lat: nearest.lat, lng: nearest.lng };
    }

    return optimized;
  }

  /**
   * Optimizes considering priority levels
   * High priority tickets are visited first, then optimized by distance within priority groups
   */
  private optimizePriorityBased(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
  ): Waypoint[] {
    if (waypoints.length <= 1) return waypoints;

    // Group waypoints by priority
    const priorityGroups = new Map<number, Waypoint[]>();
    waypoints.forEach((wp) => {
      const priority = wp.priority || 5; // Default to lowest priority
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(wp);
    });

    // Sort priorities (1 = highest)
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

    // Optimize each priority group with nearest neighbor
    const optimized: Waypoint[] = [];
    let currentLocation = startLocation;

    for (const priority of sortedPriorities) {
      const group = priorityGroups.get(priority)!;
      const optimizedGroup = this.optimizeNearestNeighbor(currentLocation, group);

      // Update sequences
      optimizedGroup.forEach((wp) => {
        wp.sequence = optimized.length + 1;
        optimized.push(wp);
      });

      // Update current location to last stop in group
      if (optimizedGroup.length > 0) {
        const last = optimizedGroup[optimizedGroup.length - 1];
        currentLocation = { lat: last.lat, lng: last.lng };
      }
    }

    return optimized;
  }

  /**
   * Optimizes respecting scheduled time windows
   * Stops with specific time requirements are prioritized and scheduled accordingly
   */
  private optimizeTimeWindow(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
    routeStartTime: Date,
  ): Waypoint[] {
    if (waypoints.length <= 1) return waypoints;

    // Separate stops with and without time windows
    const withTimeWindows = waypoints.filter((wp) => wp.scheduledTime);
    const withoutTimeWindows = waypoints.filter((wp) => !wp.scheduledTime);

    // Sort time-windowed stops by scheduled time
    withTimeWindows.sort(
      (a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime(),
    );

    const optimized: Waypoint[] = [];
    let currentLocation = startLocation;
    let currentTime = new Date(routeStartTime);
    let twIndex = 0;

    // Process stops, inserting time-windowed stops at appropriate times
    while (twIndex < withTimeWindows.length || withoutTimeWindows.length > 0) {
      // Check if we need to go to a time-windowed stop
      if (twIndex < withTimeWindows.length) {
        const nextTW = withTimeWindows[twIndex];
        const twTime = new Date(nextTW.scheduledTime!);

        // Calculate travel time to time-windowed stop
        const travelDistance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          nextTW.lat,
          nextTW.lng,
        );
        const travelTimeMinutes = travelDistance / AVERAGE_SPEED_MS / 60;
        const arrivalTime = new Date(currentTime.getTime() + travelTimeMinutes * 60000);

        // If we can fit a non-time-windowed stop before the time window
        if (
          withoutTimeWindows.length > 0 &&
          arrivalTime.getTime() + 30 * 60000 < twTime.getTime()
        ) {
          // Find nearest non-time-windowed stop
          let nearestIndex = 0;
          let nearestDistance = Infinity;
          for (let i = 0; i < withoutTimeWindows.length; i++) {
            const distance = calculateDistance(
              currentLocation.lat,
              currentLocation.lng,
              withoutTimeWindows[i].lat,
              withoutTimeWindows[i].lng,
            );
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = i;
            }
          }

          const stop = withoutTimeWindows.splice(nearestIndex, 1)[0];
          const stopTravelTime = nearestDistance / AVERAGE_SPEED_MS / 60;
          stop.sequence = optimized.length + 1;
          stop.estimatedArrival = new Date(currentTime.getTime() + stopTravelTime * 60000);
          const serviceTime = stop.serviceTimeMinutes || DEFAULT_SERVICE_TIME_MINUTES;
          stop.estimatedDeparture = new Date(stop.estimatedArrival.getTime() + serviceTime * 60000);
          optimized.push(stop);

          currentLocation = { lat: stop.lat, lng: stop.lng };
          currentTime = stop.estimatedDeparture;
        } else {
          // Go to time-windowed stop
          nextTW.sequence = optimized.length + 1;
          nextTW.estimatedArrival = arrivalTime.getTime() < twTime.getTime() ? twTime : arrivalTime;
          const serviceTime = nextTW.serviceTimeMinutes || DEFAULT_SERVICE_TIME_MINUTES;
          nextTW.estimatedDeparture = new Date(
            nextTW.estimatedArrival.getTime() + serviceTime * 60000,
          );
          optimized.push(nextTW);

          currentLocation = { lat: nextTW.lat, lng: nextTW.lng };
          currentTime = nextTW.estimatedDeparture;
          twIndex++;
        }
      } else {
        // No more time-windowed stops, optimize remaining with nearest neighbor
        const remaining = this.optimizeNearestNeighbor(currentLocation, withoutTimeWindows);
        remaining.forEach((stop) => {
          const travelDistance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            stop.lat,
            stop.lng,
          );
          const travelTimeMinutes = travelDistance / AVERAGE_SPEED_MS / 60;
          stop.sequence = optimized.length + 1;
          stop.estimatedArrival = new Date(currentTime.getTime() + travelTimeMinutes * 60000);
          const serviceTime = stop.serviceTimeMinutes || DEFAULT_SERVICE_TIME_MINUTES;
          stop.estimatedDeparture = new Date(stop.estimatedArrival.getTime() + serviceTime * 60000);
          optimized.push(stop);

          currentLocation = { lat: stop.lat, lng: stop.lng };
          currentTime = stop.estimatedDeparture;
        });
        withoutTimeWindows.length = 0; // Clear the array
      }
    }

    return optimized;
  }

  /**
   * Balanced optimization considering distance, priority, and time windows
   */
  private optimizeBalanced(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
    routeStartTime: Date,
  ): Waypoint[] {
    if (waypoints.length <= 1) return waypoints;

    // Score each waypoint based on multiple factors
    const scoredWaypoints = waypoints.map((wp) => {
      const distanceFromStart = calculateDistance(
        startLocation.lat,
        startLocation.lng,
        wp.lat,
        wp.lng,
      );

      // Priority score (1 is highest, so invert)
      const priorityScore = 10 - (wp.priority || 5);

      // Time urgency score
      let timeScore = 0;
      if (wp.scheduledTime) {
        const scheduledTime = new Date(wp.scheduledTime);
        const hoursUntilScheduled =
          (scheduledTime.getTime() - routeStartTime.getTime()) / (1000 * 60 * 60);
        timeScore = Math.max(0, 10 - hoursUntilScheduled); // More urgent = higher score
      }

      // Distance score (closer is better, normalize to 0-10)
      const maxDistance = 50000; // 50km
      const distanceScore = Math.max(0, 10 - (distanceFromStart / maxDistance) * 10);

      return {
        waypoint: wp,
        score: priorityScore * 2 + timeScore * 3 + distanceScore * 1, // Weighted scoring
        distanceFromStart,
      };
    });

    // Sort by score (highest first)
    scoredWaypoints.sort((a, b) => b.score - a.score);

    // Further optimize using nearest neighbor within similar score groups
    const optimized: Waypoint[] = [];
    let currentLocation = startLocation;
    let currentTime = new Date(routeStartTime);

    for (const scored of scoredWaypoints) {
      const wp = scored.waypoint;
      const travelDistance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        wp.lat,
        wp.lng,
      );
      const travelTimeMinutes = travelDistance / AVERAGE_SPEED_MS / 60;

      wp.sequence = optimized.length + 1;
      wp.estimatedArrival = new Date(currentTime.getTime() + travelTimeMinutes * 60000);
      const serviceTime = wp.serviceTimeMinutes || DEFAULT_SERVICE_TIME_MINUTES;
      wp.estimatedDeparture = new Date(wp.estimatedArrival.getTime() + serviceTime * 60000);
      optimized.push(wp);

      currentLocation = { lat: wp.lat, lng: wp.lng };
      currentTime = wp.estimatedDeparture;
    }

    return optimized;
  }

  /**
   * Calculate total route distance
   */
  private calculateTotalDistance(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
    endLocation?: { lat: number; lng: number },
  ): number {
    let totalDistance = 0;
    let currentLocation = startLocation;

    for (const wp of waypoints) {
      totalDistance += calculateDistance(currentLocation.lat, currentLocation.lng, wp.lat, wp.lng);
      currentLocation = { lat: wp.lat, lng: wp.lng };
    }

    if (endLocation) {
      totalDistance += calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        endLocation.lat,
        endLocation.lng,
      );
    }

    return totalDistance;
  }

  /**
   * Calculate estimated duration including travel and service time
   */
  private calculateEstimatedDuration(
    startLocation: { lat: number; lng: number },
    waypoints: Waypoint[],
    endLocation?: { lat: number; lng: number },
  ): number {
    const totalDistance = this.calculateTotalDistance(startLocation, waypoints, endLocation);
    const travelTimeMinutes = totalDistance / AVERAGE_SPEED_MS / 60;

    const totalServiceTime = waypoints.reduce(
      (sum, wp) => sum + (wp.serviceTimeMinutes || DEFAULT_SERVICE_TIME_MINUTES),
      0,
    );

    return Math.round(travelTimeMinutes + totalServiceTime);
  }

  /**
   * Main optimization method
   */
  async optimizeRoute(input: RouteOptimizationInput): Promise<OptimizedRoute> {
    const algorithm = input.algorithm || 'nearest_neighbor';
    const routeStartTime = new Date();

    // Calculate original distance (unoptimized)
    const originalDistance = this.calculateTotalDistance(
      input.startLocation,
      input.waypoints,
      input.endLocation,
    );
    const originalDuration = this.calculateEstimatedDuration(
      input.startLocation,
      input.waypoints,
      input.endLocation,
    );

    // Apply optimization algorithm
    let optimizedWaypoints: Waypoint[];

    switch (algorithm) {
      case 'priority_based':
        optimizedWaypoints = this.optimizePriorityBased(input.startLocation, input.waypoints);
        break;
      case 'time_window':
        optimizedWaypoints = this.optimizeTimeWindow(
          input.startLocation,
          input.waypoints,
          routeStartTime,
        );
        break;
      case 'balanced':
        optimizedWaypoints = this.optimizeBalanced(
          input.startLocation,
          input.waypoints,
          routeStartTime,
        );
        break;
      case 'nearest_neighbor':
      default:
        optimizedWaypoints = this.optimizeNearestNeighbor(
          input.startLocation,
          input.waypoints,
          input.endLocation,
        );
    }

    // Apply max stops limit if specified
    if (input.maxStopsPerRoute && optimizedWaypoints.length > input.maxStopsPerRoute) {
      optimizedWaypoints = optimizedWaypoints.slice(0, input.maxStopsPerRoute);
    }

    // Calculate optimized metrics
    const optimizedDistance = this.calculateTotalDistance(
      input.startLocation,
      optimizedWaypoints,
      input.endLocation,
    );
    const optimizedDuration = this.calculateEstimatedDuration(
      input.startLocation,
      optimizedWaypoints,
      input.endLocation,
    );

    // Calculate savings
    const distanceSaved = originalDistance - optimizedDistance;
    const timeSaved = originalDuration - optimizedDuration;
    const percentageImprovement =
      originalDistance > 0 ? Math.round((distanceSaved / originalDistance) * 100) : 0;

    return {
      waypoints: optimizedWaypoints,
      totalDistance: Math.round(optimizedDistance),
      estimatedDuration: optimizedDuration,
      optimizationAlgorithm: algorithm,
      savings: {
        distanceSavedMeters: Math.round(distanceSaved),
        timeSavedMinutes: Math.round(timeSaved),
        percentageImprovement: Math.max(0, percentageImprovement),
      },
    };
  }

  /**
   * Create an optimized route assignment
   */
  async createOptimizedRoute(
    input: RouteOptimizationInput,
    routeName: string,
  ): Promise<RouteAssignment> {
    const optimized = await this.optimizeRoute(input);

    const routeData: InsertRouteAssignment = {
      tenantId: input.tenant_id,
      technicianId: input.technicianId,
      routeName,
      routeDate: new Date(),
      routeStatus: 'assigned',
      waypoints: optimized.waypoints,
      totalStops: optimized.waypoints.length,
      completedStops: 0,
      optimizedRoute: true,
      optimizationAlgorithm: optimized.optimizationAlgorithm,
      totalDistance: String(optimized.totalDistance),
      estimatedDuration: optimized.estimatedDuration,
      startLocation: input.startLocation,
      endLocation: input.endLocation || null,
    };

    return await storage.createRouteAssignment(routeData);
  }

  /**
   * Re-optimize an existing route (e.g., after adding/removing stops)
   */
  async reoptimizeRoute(
    routeId: string,
    tenantId: string,
    algorithm?: 'nearest_neighbor' | 'priority_based' | 'time_window' | 'balanced',
  ): Promise<OptimizedRoute | null> {
    const route = await storage.getRouteAssignment(routeId, tenantId);
    if (!route) return null;

    const waypoints = (route.waypoints as Waypoint[]).filter((wp) => wp.status !== 'completed');
    const startLocation = (route.startLocation as { lat: number; lng: number }) || {
      lat: 0,
      lng: 0,
    };
    const endLocation = route.endLocation as { lat: number; lng: number } | undefined;

    const optimized = await this.optimizeRoute({
      tenantId,
      technicianId: route.technicianId,
      startLocation,
      endLocation,
      waypoints,
      algorithm: algorithm || (route.optimizationAlgorithm as any) || 'nearest_neighbor',
    });

    // Update the route with optimized waypoints
    await storage.updateRouteAssignment(routeId, tenantId, {
      waypoints: optimized.waypoints,
      totalDistance: String(optimized.totalDistance),
      estimatedDuration: optimized.estimatedDuration,
      optimizedRoute: true,
      optimizationAlgorithm: optimized.optimizationAlgorithm,
    });

    return optimized;
  }

  /**
   * Get route analytics for a technician
   */
  async getRouteAnalytics(
    technicianId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RouteAnalytics> {
    const routes = await storage.getRouteAssignments(tenantId, { technicianId });

    // Filter routes within date range
    const filteredRoutes = routes.filter((route) => {
      const routeDate = new Date(route.routeDate);
      return routeDate >= startDate && routeDate <= endDate;
    });

    // Calculate analytics
    let totalStops = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    let onTimeCount = 0;
    const areaCount = new Map<string, number>();
    const hourCount = new Map<number, number>();

    for (const route of filteredRoutes) {
      totalStops += route.totalStops;
      totalDistance += parseFloat(route.totalDistance || '0');
      totalDuration += route.actualDuration || route.estimatedDuration || 0;

      // Check if route was on time
      if (route.actualDuration && route.estimatedDuration) {
        if (route.actualDuration <= route.estimatedDuration * 1.1) {
          // Within 10% of estimate
          onTimeCount++;
        }
      }

      // Collect area data from waypoints
      const waypoints = route.waypoints as Waypoint[];
      for (const wp of waypoints) {
        // Extract city/area from address
        const parts = wp.address?.split(',') || [];
        if (parts.length >= 2) {
          const area = parts[parts.length - 2].trim();
          areaCount.set(area, (areaCount.get(area) || 0) + 1);
        }
      }

      // Collect peak hours
      if (route.routeStartTime) {
        const hour = new Date(route.routeStartTime).getHours();
        hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
      }
    }

    // Calculate efficiency score (0-100)
    const avgActualDuration = totalDuration / (filteredRoutes.length || 1);
    const avgEstimatedDuration =
      filteredRoutes.reduce((sum, r) => sum + (r.estimatedDuration || 0), 0) /
      (filteredRoutes.length || 1);
    const efficiencyRatio = avgEstimatedDuration > 0 ? avgActualDuration / avgEstimatedDuration : 1;
    const efficiencyScore = Math.max(0, Math.min(100, Math.round((1 / efficiencyRatio) * 100)));

    // Sort and format top areas
    const sortedAreas = Array.from(areaCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, count]) => ({ area, count }));

    // Sort and format peak hours
    const sortedHours = Array.from(hourCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour, count }));

    return {
      technicianId,
      period: { start: startDate, end: endDate },
      totalRoutes: filteredRoutes.length,
      totalStops,
      totalDistance: Math.round(totalDistance),
      totalDuration,
      averageStopsPerRoute:
        filteredRoutes.length > 0 ? Math.round((totalStops / filteredRoutes.length) * 10) / 10 : 0,
      averageDistancePerRoute:
        filteredRoutes.length > 0 ? Math.round(totalDistance / filteredRoutes.length) : 0,
      averageTimePerStop: totalStops > 0 ? Math.round(totalDuration / totalStops) : 0,
      onTimePercentage:
        filteredRoutes.length > 0 ? Math.round((onTimeCount / filteredRoutes.length) * 100) : 0,
      routeEfficiencyScore: efficiencyScore,
      mostVisitedAreas: sortedAreas,
      peakHours: sortedHours,
    };
  }

  /**
   * Suggest optimal route splits for multiple technicians
   */
  async suggestMultiTechnicianRoutes(
    tenantId: string,
    technicianIds: string[],
    waypoints: Waypoint[],
    baseLocations: Map<string, { lat: number; lng: number }>,
  ): Promise<Map<string, OptimizedRoute>> {
    const results = new Map<string, OptimizedRoute>();

    if (technicianIds.length === 0 || waypoints.length === 0) {
      return results;
    }

    // Cluster waypoints by geographic proximity to technician base locations
    const waypointAssignments = new Map<string, Waypoint[]>();
    technicianIds.forEach((id) => waypointAssignments.set(id, []));

    for (const wp of waypoints) {
      let nearestTechId = technicianIds[0];
      let nearestDistance = Infinity;

      for (const techId of technicianIds) {
        const baseLocation = baseLocations.get(techId);
        if (!baseLocation) continue;

        const distance = calculateDistance(baseLocation.lat, baseLocation.lng, wp.lat, wp.lng);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTechId = techId;
        }
      }

      waypointAssignments.get(nearestTechId)!.push(wp);
    }

    // Optimize route for each technician
    for (const techId of technicianIds) {
      const assignedWaypoints = waypointAssignments.get(techId)!;
      const baseLocation = baseLocations.get(techId);

      if (assignedWaypoints.length > 0 && baseLocation) {
        const optimized = await this.optimizeRoute({
          tenantId,
          technicianId: techId,
          startLocation: baseLocation,
          waypoints: assignedWaypoints,
          algorithm: 'balanced',
        });
        results.set(techId, optimized);
      }
    }

    return results;
  }
}

export const routeOptimizationService = new RouteOptimizationService();
