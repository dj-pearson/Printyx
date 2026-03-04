import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeExecFile,
  validateCommand,
  validateArguments,
  CommandNotAllowedError,
  DangerousArgumentError,
  ALLOWED_BINARIES,
} from '../../lib/safe-exec';

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(null, 'mock stdout', 'mock stderr');
    return {};
  }),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

describe('SEC-005: Command Injection Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCommand', () => {
    it('should allow permitted binaries', () => {
      for (const binary of ALLOWED_BINARIES) {
        expect(() => validateCommand(binary)).not.toThrow();
      }
    });

    it('should allow full path to permitted binary', () => {
      expect(() => validateCommand('/usr/bin/pg_dump')).not.toThrow();
      expect(() => validateCommand('/usr/local/bin/node')).not.toThrow();
    });

    it('should reject disallowed binary', () => {
      expect(() => validateCommand('rm')).toThrow(CommandNotAllowedError);
      expect(() => validateCommand('curl')).toThrow(CommandNotAllowedError);
      expect(() => validateCommand('bash')).toThrow(CommandNotAllowedError);
      expect(() => validateCommand('sh')).toThrow(CommandNotAllowedError);
      expect(() => validateCommand('/bin/rm')).toThrow(CommandNotAllowedError);
    });
  });

  describe('validateArguments', () => {
    it('should accept safe arguments', () => {
      expect(() => validateArguments(['--host', 'localhost', '--port', '5432'])).not.toThrow();
      expect(() => validateArguments(['-f', '/path/to/file.sql'])).not.toThrow();
      expect(() => validateArguments(['--format=custom'])).not.toThrow();
    });

    it('should reject semicolon in args', () => {
      expect(() => validateArguments(['--host', 'localhost; rm -rf /'])).toThrow(
        DangerousArgumentError
      );
      expect(() => validateArguments([';ls'])).toThrow(DangerousArgumentError);
    });

    it('should reject pipe injection', () => {
      expect(() => validateArguments(['--output', 'file | cat /etc/passwd'])).toThrow(
        DangerousArgumentError
      );
      expect(() => validateArguments(['|whoami'])).toThrow(DangerousArgumentError);
    });

    it('should reject backtick injection', () => {
      expect(() => validateArguments(['`whoami`'])).toThrow(DangerousArgumentError);
      expect(() => validateArguments(['--name', 'test`id`'])).toThrow(DangerousArgumentError);
    });

    it('should reject $() subshell injection', () => {
      expect(() => validateArguments(['$(whoami)'])).toThrow(DangerousArgumentError);
      expect(() => validateArguments(['--db', 'test$(cat /etc/passwd)'])).toThrow(
        DangerousArgumentError
      );
    });

    it('should reject && chaining', () => {
      expect(() => validateArguments(['--name', 'test && rm -rf /'])).toThrow(
        DangerousArgumentError
      );
    });

    it('should reject || chaining', () => {
      expect(() => validateArguments(['--name', 'test || malicious'])).toThrow(
        DangerousArgumentError
      );
    });
  });

  describe('safeExecFile', () => {
    it('should execute allowed binary and return result', async () => {
      const result = await safeExecFile('node', ['--version']);
      expect(result).toEqual({
        stdout: 'mock stdout',
        stderr: 'mock stderr',
        exitCode: 0,
      });
    });

    it('should reject disallowed binary', async () => {
      await expect(safeExecFile('rm', ['-rf', '/'])).rejects.toThrow(CommandNotAllowedError);
    });

    it('should reject dangerous arguments', async () => {
      await expect(safeExecFile('node', ['--eval', 'code; rm -rf /'])).rejects.toThrow(
        DangerousArgumentError
      );
    });

    it('should handle timeout via options', async () => {
      const { execFile } = await import('child_process');
      const mockExecFile = vi.mocked(execFile);

      // Simulate a timeout error
      mockExecFile.mockImplementationOnce(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          const error = Object.assign(new Error('Command timed out'), {
            killed: true,
            signal: 'SIGTERM',
            code: null,
          });
          (cb as Function)(error, '', 'timed out');
          return {} as ReturnType<typeof execFile>;
        }
      );

      await expect(safeExecFile('node', ['--version'], { timeout: 100 })).rejects.toThrow(
        'Command timed out after 100ms'
      );
    });

    it('should handle non-zero exit code', async () => {
      const { execFile } = await import('child_process');
      const mockExecFile = vi.mocked(execFile);

      mockExecFile.mockImplementationOnce(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          const error = Object.assign(new Error('Command failed'), {
            killed: false,
            signal: null,
            code: 1,
          });
          (cb as Function)(error, '', 'error output');
          return {} as ReturnType<typeof execFile>;
        }
      );

      const result = await safeExecFile('node', ['--version']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('error output');
    });
  });
});
