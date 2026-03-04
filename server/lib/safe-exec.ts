/**
 * SEC-005: Safe Command Execution Utility
 *
 * Provides a secure wrapper around child_process.execFile that:
 * - Uses execFile (not exec) to avoid shell interpolation
 * - Validates commands against an allowlist of permitted binaries
 * - Validates arguments to prevent injection via metacharacters
 * - Enforces execution timeouts
 * - Logs all execution attempts
 */

import { execFile as nodeExecFile } from 'child_process';
import type { ExecFileOptions } from 'child_process';
import { createModuleLogger } from './logger';

const log = createModuleLogger('safe-exec');

/** Allowlist of permitted binary names */
const ALLOWED_BINARIES = new Set([
  'node',
  'npm',
  'pg_dump',
  'psql',
  'gzip',
  'gunzip',
]);

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Patterns that indicate shell injection attempts in arguments */
const DANGEROUS_ARG_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /;/, name: 'semicolon' },
  { pattern: /\|/, name: 'pipe' },
  { pattern: /`/, name: 'backtick' },
  { pattern: /\$\(/, name: 'subshell $()' },
  { pattern: /&&/, name: 'logical AND (&&)' },
  { pattern: /\|\|/, name: 'logical OR (||)' },
  { pattern: />\s*/, name: 'output redirect' },
  { pattern: /<\s*/, name: 'input redirect' },
];

export interface SafeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandNotAllowedError extends Error {
  constructor(command: string) {
    super(`Command not in allowlist: ${command}`);
    this.name = 'CommandNotAllowedError';
  }
}

export class DangerousArgumentError extends Error {
  constructor(argIndex: number, patternName: string) {
    super(`Dangerous pattern "${patternName}" detected in argument at index ${argIndex}`);
    this.name = 'DangerousArgumentError';
  }
}

/**
 * Extracts the base binary name from a command path.
 * e.g., "/usr/bin/pg_dump" -> "pg_dump", "node" -> "node"
 */
function getBaseName(command: string): string {
  const parts = command.split('/');
  return parts[parts.length - 1];
}

/**
 * Validates that a command is in the allowlist.
 */
function validateCommand(command: string): void {
  const baseName = getBaseName(command);
  if (!ALLOWED_BINARIES.has(baseName)) {
    throw new CommandNotAllowedError(baseName);
  }
}

/**
 * Validates that arguments do not contain dangerous shell metacharacters.
 */
function validateArguments(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    for (const { pattern, name } of DANGEROUS_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        throw new DangerousArgumentError(i, name);
      }
    }
  }
}

/**
 * Safely execute a command using execFile (no shell interpolation).
 *
 * @param command - The binary to execute (must be in the allowlist)
 * @param args - Arguments to pass to the command
 * @param options - Optional execution options (timeout defaults to 30s)
 * @returns Promise resolving to { stdout, stderr, exitCode }
 */
export async function safeExecFile(
  command: string,
  args: string[],
  options?: ExecFileOptions
): Promise<SafeExecResult> {
  // Validate command against allowlist
  validateCommand(command);

  // Validate arguments for dangerous patterns
  validateArguments(args);

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const execOptions: ExecFileOptions = {
    ...options,
    timeout,
    shell: false as unknown as string, // Explicitly disable shell
  };

  log.info({ command: getBaseName(command), args, timeout }, 'Executing command');

  return new Promise<SafeExecResult>((resolve, reject) => {
    const child = nodeExecFile(
      command,
      args,
      { ...execOptions, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const stdoutStr = typeof stdout === 'string' ? stdout : '';
        const stderrStr = typeof stderr === 'string' ? stderr : '';

        if (error) {
          // Check if this was a timeout
          if (error.killed && error.signal === 'SIGTERM') {
            log.warn(
              { command: getBaseName(command), timeout },
              'Command killed due to timeout'
            );
          }

          const exitCode = error.code != null ? (typeof error.code === 'number' ? error.code : 1) : 1;

          log.error(
            { command: getBaseName(command), exitCode, stderr: stderrStr.substring(0, 500) },
            'Command execution failed'
          );

          // Still resolve with the output and exit code rather than rejecting,
          // so callers can inspect stderr. Reject only for system-level errors.
          if (error.killed) {
            reject(new Error(`Command timed out after ${timeout}ms`));
            return;
          }

          resolve({
            stdout: stdoutStr,
            stderr: stderrStr,
            exitCode,
          });
          return;
        }

        log.info(
          { command: getBaseName(command), exitCode: 0 },
          'Command executed successfully'
        );

        resolve({
          stdout: stdoutStr,
          stderr: stderrStr,
          exitCode: 0,
        });
      }
    );

    // Safety: ensure the child process reference exists
    if (!child) {
      reject(new Error('Failed to spawn child process'));
    }
  });
}

/** Exported for testing */
export { ALLOWED_BINARIES, DANGEROUS_ARG_PATTERNS, validateCommand, validateArguments };
