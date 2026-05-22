import { spawn, ChildProcess } from 'child_process';
import { BaseTunnelProvider } from './base';

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const START_TIMEOUT_MS = 30_000;

export class CloudflareTunnelProvider extends BaseTunnelProvider {
  private process: ChildProcess | null = null;

  constructor(private readonly cloudflaredBinPath: string) {
    super('cloudflare');
  }

  async start(localPort: number): Promise<string> {
    const bin = this.cloudflaredBinPath;

    return new Promise((resolve, reject) => {
      this.process = spawn(bin, ['tunnel', '--url', `http://localhost:${localPort}`]);

      const timeout = setTimeout(() => {
        this.process?.kill();
        reject(new Error('cloudflare tunnel timed out waiting for URL'));
      }, START_TIMEOUT_MS);

      // cloudflared prints the tunnel URL to stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.logger.debug('cloudflared stderr', { text });
        const match = text.match(TUNNEL_URL_PATTERN);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });

      this.process.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          reject(new Error(`cloudflared exited with code ${code}`));
        }
        this.disconnectedCallback?.();
      });
    });
  }

  async stop(): Promise<void> {
    this.process?.kill();
    this.process = null;
  }
}
