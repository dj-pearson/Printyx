import axios, { AxiosInstance } from 'axios';

/**
 * API Client for Printyx Backend
 *
 * Handles all HTTP requests to the Printyx API
 */
class APIClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    // TODO: Replace with your actual API URL
    const baseURL = __DEV__
      ? 'http://localhost:5000/api' // Development
      : 'https://api.printyx.com/api'; // Production

    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to all requests
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.authToken = null;
          // TODO: Trigger logout
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Mobile API - Sync
  async sync(since?: string) {
    const params = since ? { since } : {};
    const response = await this.client.get('/mobile/sync', { params });
    return response.data;
  }

  // Mobile API - Tickets
  async getTickets(status?: string) {
    const params = status ? { status } : {};
    const response = await this.client.get('/mobile/tickets', { params });
    return response.data;
  }

  async getTicket(id: string) {
    const response = await this.client.get(`/mobile/tickets/${id}`);
    return response.data;
  }

  async updateTicket(id: string, updates: any) {
    const response = await this.client.patch(`/mobile/tickets/${id}`, updates);
    return response.data;
  }

  async startTicket(id: string, location?: { latitude: number; longitude: number }) {
    const response = await this.client.post(`/mobile/tickets/${id}/start`, location);
    return response.data;
  }

  async completeTicket(
    id: string,
    data: {
      signature: string;
      signatureName: string;
      signatureTitle?: string;
      resolution: string;
      partsUsed?: any[];
      timeSpent?: number;
      latitude?: number;
      longitude?: number;
    }
  ) {
    const response = await this.client.post(`/mobile/tickets/${id}/complete`, data);
    return response.data;
  }

  async addTicketNote(id: string, note: string, isInternal: boolean = false) {
    const response = await this.client.post(`/mobile/tickets/${id}/notes`, {
      note,
      isInternal,
    });
    return response.data;
  }

  async uploadTicketPhotos(id: string, photos: File[]) {
    const formData = new FormData();
    photos.forEach((photo, index) => {
      formData.append('photos', photo as any);
    });

    const response = await this.client.post(`/mobile/tickets/${id}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Mobile API - Equipment
  async getEquipment(id: string) {
    const response = await this.client.get(`/mobile/equipment/${id}`);
    return response.data;
  }

  async scanEquipment(qrCode?: string, serialNumber?: string) {
    const response = await this.client.post('/mobile/equipment/scan', {
      qrCode,
      serialNumber,
    });
    return response.data;
  }

  // Mobile API - GPS
  async trackLocation(location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    ticketId?: string;
    eventType?: string;
  }) {
    const response = await this.client.post('/mobile/location', location);
    return response.data;
  }

  // Mobile API - Stats
  async getStats() {
    const response = await this.client.get('/mobile/stats');
    return response.data;
  }
}

export const apiClient = new APIClient();
