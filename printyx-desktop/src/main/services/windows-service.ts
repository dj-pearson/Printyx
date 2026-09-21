import log from 'electron-log';
import { app } from 'electron';
import path from 'path';

export class WindowsService {
  /**
   * SEC-005: the sc/net calls below use execFileSync with an argument array,
   * not execSync with a template literal. `serviceName` is a constant today,
   * so the old form was not exploitable - but the whole point of a private
   * field is that somebody may make it configurable, and the day it takes an
   * installer flag or a config file the shell string is a command injection in
   * the Electron main process. execFileSync never starts a shell, so there is
   * nothing to escape and nothing to get wrong later.
   */
  private serviceName = 'PrintyxMonitor';
  private serviceDisplayName = 'Printyx Printer Monitoring Service';

  async install(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Windows services are only supported on Windows');
    }

    try {
      // Dynamic import for node-windows (only available on Windows)
      const nodeWindows = await import('node-windows');
      const Service = nodeWindows.Service;

      const svc = new Service({
        name: this.serviceName,
        description: 'Monitors network printers and sends data to Printyx platform',
        script: path.join(app.getPath('exe'), '../resources/app.asar/dist/main/main.js'),
        nodeOptions: [],
        env: {
          name: 'NODE_ENV',
          value: 'production',
        },
      });

      return new Promise((resolve, reject) => {
        svc.on('install', () => {
          log.info('Windows service installed successfully');
          svc.start();
          resolve();
        });

        svc.on('error', (error: Error) => {
          log.error('Failed to install Windows service:', error);
          reject(error);
        });

        svc.install();
      });
    } catch (error) {
      log.error('Failed to load node-windows:', error);
      throw new Error('Failed to install Windows service: ' + (error as Error).message);
    }
  }

  async uninstall(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Windows services are only supported on Windows');
    }

    try {
      const nodeWindows = await import('node-windows');
      const Service = nodeWindows.Service;

      const svc = new Service({
        name: this.serviceName,
        script: '', // Not needed for uninstall
      });

      return new Promise((resolve, reject) => {
        svc.on('uninstall', () => {
          log.info('Windows service uninstalled successfully');
          resolve();
        });

        svc.on('error', (error: Error) => {
          log.error('Failed to uninstall Windows service:', error);
          reject(error);
        });

        svc.uninstall();
      });
    } catch (error) {
      log.error('Failed to load node-windows:', error);
      throw new Error('Failed to uninstall Windows service: ' + (error as Error).message);
    }
  }

  async getStatus(): Promise<{ installed: boolean; running: boolean }> {
    if (process.platform !== 'win32') {
      return { installed: false, running: false };
    }

    try {
      const { execFileSync } = await import('child_process');
      const output = execFileSync('sc', ['query', this.serviceName], {
        encoding: 'utf8',
      });

      const installed = !output.includes('does not exist');
      const running = output.includes('RUNNING');

      return { installed, running };
    } catch (error) {
      // Service doesn't exist or sc command failed
      return { installed: false, running: false };
    }
  }

  async start(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Windows services are only supported on Windows');
    }

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('net', ['start', this.serviceName], { encoding: 'utf8' });
      log.info('Windows service started');
    } catch (error) {
      log.error('Failed to start Windows service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Windows services are only supported on Windows');
    }

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('net', ['stop', this.serviceName], { encoding: 'utf8' });
      log.info('Windows service stopped');
    } catch (error) {
      log.error('Failed to stop Windows service:', error);
      throw error;
    }
  }
}
