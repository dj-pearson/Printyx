/**
 * CSP Violation Reporting Endpoint
 *
 * Receives Content Security Policy violation reports from browsers.
 * These are sent automatically when a CSP directive is violated.
 * No authentication required - browsers send these automatically.
 */

import type { Express, Request, Response } from 'express';
import express from 'express';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('csp-report');

export function registerCspReportRoutes(app: Express): void {
  // CSP reports are sent as application/csp-report or application/json
  app.post(
    '/api/csp-report',
    express.json({ type: ['application/csp-report', 'application/json'], limit: '16kb' }),
    (req: Request, res: Response) => {
      try {
        const report = req.body?.['csp-report'] || req.body;

        if (!report) {
          return res.status(400).json({ message: 'No CSP report payload' });
        }

        // Log the violation with structured data
        log.warn(
          {
            violatedDirective: report['violated-directive'] || report.violatedDirective,
            blockedUri: report['blocked-uri'] || report.blockedUri,
            documentUri: report['document-uri'] || report.documentUri,
            originalPolicy: report['original-policy'] || report.originalPolicy,
            sourceFile: report['source-file'] || report.sourceFile,
            lineNumber: report['line-number'] || report.lineNumber,
            columnNumber: report['column-number'] || report.columnNumber,
            disposition: report.disposition,
          },
          'CSP violation reported',
        );

        res.status(204).end();
      } catch (err) {
        log.error({ err }, 'Error processing CSP report');
        res.status(204).end(); // Always return 204 to not leak info
      }
    },
  );
}
