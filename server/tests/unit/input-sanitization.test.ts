import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  checkPathTraversal,
  stripHtml,
  stripControlChars,
  inputSanitization,
  RICH_HTML_FIELDS,
} from '../../middleware/input-sanitization';

describe('Input Sanitization Middleware', () => {
  describe('stripHtml', () => {
    it('should remove script tags', () => {
      expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('should remove img onerror payloads', () => {
      expect(stripHtml('<img src=x onerror=alert(1)>')).toBe('');
    });

    it('should remove nested tags', () => {
      expect(stripHtml('<div><b>hello</b></div>')).toBe('hello');
    });

    it('should leave plain text unchanged', () => {
      expect(stripHtml('Hello World')).toBe('Hello World');
    });

    it('should handle self-closing tags', () => {
      expect(stripHtml('Line1<br/>Line2')).toBe('Line1Line2');
    });
  });

  describe('stripControlChars', () => {
    it('should remove null bytes', () => {
      expect(stripControlChars('hello\x00world')).toBe('helloworld');
    });

    it('should remove bell character', () => {
      expect(stripControlChars('hello\x07world')).toBe('helloworld');
    });

    it('should preserve tabs, newlines, carriage returns', () => {
      expect(stripControlChars('line1\tline2\nline3\r\n')).toBe('line1\tline2\nline3\r\n');
    });

    it('should remove DEL character', () => {
      expect(stripControlChars('hello\x7Fworld')).toBe('helloworld');
    });
  });

  describe('checkPathTraversal', () => {
    it('should detect ../ pattern', () => {
      expect(checkPathTraversal('../../etc/passwd')).toBe(true);
    });

    it('should detect ..\\ pattern', () => {
      expect(checkPathTraversal('..\\..\\windows\\system32')).toBe(true);
    });

    it('should detect URL-encoded %2e%2e', () => {
      expect(checkPathTraversal('%2e%2e/etc/passwd')).toBe(true);
    });

    it('should detect double-encoded %252e%252e', () => {
      expect(checkPathTraversal('%252e%252e/etc/passwd')).toBe(true);
    });

    it('should detect mixed ..%2f', () => {
      expect(checkPathTraversal('..%2fetc/passwd')).toBe(true);
    });

    it('should allow normal paths', () => {
      expect(checkPathTraversal('/api/users/123')).toBe(false);
    });

    it('should check nested object values', () => {
      expect(checkPathTraversal({ path: '../../etc/passwd' })).toBe(true);
    });

    it('should check array values', () => {
      expect(checkPathTraversal(['safe', '../etc/passwd'])).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(checkPathTraversal(null)).toBe(false);
      expect(checkPathTraversal(undefined)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should strip <script> tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>Hello');
      expect(result).toBe('alert("xss")Hello');
      expect(result).not.toContain('<script>');
    });

    it('should strip onerror event handlers', () => {
      const result = sanitizeString('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('onerror');
    });

    it('should strip javascript: protocol', () => {
      const result = sanitizeString('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('should strip data:text/html payloads', () => {
      const result = sanitizeString('<a href="data:text/html,<script>alert(1)</script>">x</a>');
      expect(result).not.toContain('data:text/html');
    });

    it('should remove null bytes', () => {
      const result = sanitizeString('hello\x00world');
      expect(result).toBe('helloworld');
    });

    it('should allow safe HTML in whitelisted fields', () => {
      const result = sanitizeString('<p>Hello <strong>World</strong></p>', 'emailBody');
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should strip dangerous tags even in whitelisted fields', () => {
      const result = sanitizeString('<script>alert(1)</script><p>Safe</p>', 'emailBody');
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe</p>');
    });

    it('should strip event handlers in whitelisted fields', () => {
      const result = sanitizeString('<div onmouseover="alert(1)">text</div>', 'htmlContent');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string values in an object', () => {
      const input = {
        name: '<script>alert(1)</script>John',
        email: 'john@example.com',
        age: 30,
      };
      const result = sanitizeObject(input);
      expect(result.name).toBe('alert(1)John');
      expect(result.email).toBe('john@example.com');
      expect(result.age).toBe(30);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>Bold</b> Name',
        },
      };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('Bold Name');
    });

    it('should handle arrays', () => {
      const input = ['<script>xss</script>', 'safe'];
      const result = sanitizeObject(input);
      expect(result[0]).toBe('xss');
      expect(result[1]).toBe('safe');
    });

    it('should preserve null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should sanitize rich HTML field with DOMPurify', () => {
      const input = {
        emailBody: '<p>Hello</p><script>alert(1)</script>',
        subject: '<b>Subject</b>',
      };
      const result = sanitizeObject(input);
      expect(result.emailBody).toContain('<p>Hello</p>');
      expect(result.emailBody).not.toContain('<script>');
      expect(result.subject).toBe('Subject');
    });
  });

  describe('inputSanitization middleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {
        params: {},
        query: {},
        body: {},
      };
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      next = vi.fn();
    });

    it('should call next() for clean input', () => {
      req.body = { name: 'John Doe' };
      inputSanitization(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize body strings', () => {
      req.body = { name: '<script>alert(1)</script>John' };
      inputSanitization(req, res, next);
      expect(req.body.name).toBe('alert(1)John');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize query strings', () => {
      req.query = { search: '<img src=x onerror=alert(1)>' };
      inputSanitization(req, res, next);
      expect(req.query.search).toBe('');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize params', () => {
      req.params = { id: 'abc\x00def' };
      inputSanitization(req, res, next);
      expect(req.params.id).toBe('abcdef');
      expect(next).toHaveBeenCalled();
    });

    it('should reject path traversal in body', () => {
      req.body = { file: '../../etc/passwd' };
      inputSanitization(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'PATH_TRAVERSAL_DETECTED' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject path traversal in query', () => {
      req.query = { path: '%2e%2e/secret' };
      inputSanitization(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject path traversal in params', () => {
      req.params = { file: '../config.json' };
      inputSanitization(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle common XSS payloads', () => {
      const payloads = [
        '<script>document.cookie</script>',
        '<img src=x onerror=alert(document.domain)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '"><script>alert(1)</script>',
        "';alert(1)//",
        '<iframe src="javascript:alert(1)">',
      ];

      for (const payload of payloads) {
        req.body = { input: payload };
        inputSanitization(req, res, next);
        expect(req.body.input).not.toContain('<script>');
        expect(req.body.input).not.toContain('<img');
        expect(req.body.input).not.toContain('<svg');
        expect(req.body.input).not.toContain('<body');
        expect(req.body.input).not.toContain('<iframe');
      }
    });
  });

  describe('RICH_HTML_FIELDS', () => {
    it('should include expected whitelisted fields', () => {
      expect(RICH_HTML_FIELDS.has('emailBody')).toBe(true);
      expect(RICH_HTML_FIELDS.has('htmlContent')).toBe(true);
      expect(RICH_HTML_FIELDS.has('kbContent')).toBe(true);
    });

    it('should not include regular fields', () => {
      expect(RICH_HTML_FIELDS.has('name')).toBe(false);
      expect(RICH_HTML_FIELDS.has('email')).toBe(false);
    });
  });
});
