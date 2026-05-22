import { BaseTunnelProvider } from './base';

export class DevTunnelProvider extends BaseTunnelProvider {
  constructor() {
    super('devtunnel');
  }

  async start(localPort: number): Promise<string> {
    const baseUrl = import.meta.env.MAIN_VITE_DEV_TUNNEL_URL || 'http://127.0.0.1';
    const url = `${baseUrl}:${localPort}`;
    this.logger.info('dev tunnel active', { url });
    return url;
  }

  async stop(): Promise<void> {}
}
