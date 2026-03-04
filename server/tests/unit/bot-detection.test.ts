import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { getBotScore, botDetection } from '../../middleware/bot-detection';

/**
 * Helper to create a mock Express request with the given headers.
 */
function mockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers,
    ip: '127.0.0.1',
    method: 'GET',
    path: '/api/test',
  } as unknown as Request;
}

describe('Bot Detection Middleware (SEC-014)', () => {
  describe('getBotScore', () => {
    it('should return score 0 for a normal Chrome browser', () => {
      const req = mockRequest({
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
      });
      expect(getBotScore(req)).toBe(0);
    });

    it('should return a high score for curl User-Agent', () => {
      const req = mockRequest({
        'user-agent': 'curl/7.88.1',
        // curl typically sends Accept: */* but no Accept-Language or Accept-Encoding
        accept: '*/*',
      });
      const score = getBotScore(req);
      // Missing Accept-Language (+20) + Missing Accept-Encoding (+10) = 30
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('should return a high score for sqlmap User-Agent', () => {
      const req = mockRequest({
        'user-agent': 'sqlmap/1.7#stable',
      });
      const score = getBotScore(req);
      // Known tool (+80) + missing headers (+20 + +15 + +10) = 100 (capped)
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should return a moderate score for Headless Chrome', () => {
      const req = mockRequest({
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
        accept: 'text/html',
        'accept-encoding': 'gzip, deflate',
      });
      const score = getBotScore(req);
      // Headless (+60) + Missing Accept-Language (+20) = 80
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should return a moderate score when all browser headers are missing', () => {
      const req = mockRequest({
        'user-agent': 'python-requests/2.31.0',
      });
      const score = getBotScore(req);
      // Missing Accept-Language (+20) + Missing Accept (+15) + Missing Accept-Encoding (+10) = 45
      expect(score).toBeGreaterThanOrEqual(40);
    });

    it('should not flag Googlebot (allowlisted)', () => {
      const req = mockRequest({
        'user-agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      });
      expect(getBotScore(req)).toBe(0);
    });

    it('should not flag Bingbot (allowlisted)', () => {
      const req = mockRequest({
        'user-agent':
          'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      });
      expect(getBotScore(req)).toBe(0);
    });

    it('should detect nmap scans', () => {
      const req = mockRequest({
        'user-agent': 'Nmap Scripting Engine',
      });
      const score = getBotScore(req);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should detect nikto scans', () => {
      const req = mockRequest({
        'user-agent': 'Mozilla/5.00 (Nikto/2.1.6)',
      });
      const score = getBotScore(req);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should detect nuclei scans', () => {
      const req = mockRequest({
        'user-agent': 'nuclei - Open-source project',
      });
      const score = getBotScore(req);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should cap score at 100', () => {
      const req = mockRequest({
        'user-agent': 'sqlmap HeadlessChrome',
        // Known tool (+80) + headless (+60) + missing all headers (+45) = 185 -> capped at 100
      });
      const score = getBotScore(req);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('botDetection middleware', () => {
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRes = {} as Response;
      mockNext = vi.fn();
    });

    it('should call next() for normal requests', () => {
      const middleware = botDetection();
      const req = mockRequest({
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US',
        accept: 'text/html',
        'accept-encoding': 'gzip',
      });

      middleware(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should call next() even for suspicious requests (log-only mode)', () => {
      const middleware = botDetection();
      const req = mockRequest({
        'user-agent': 'sqlmap/1.7#stable',
      });

      middleware(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should call next() for legitimate crawlers', () => {
      const middleware = botDetection();
      const req = mockRequest({
        'user-agent': 'Googlebot/2.1',
      });

      middleware(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });
});
