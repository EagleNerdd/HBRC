import localtunnel, { Tunnel } from 'localtunnel';
import { BaseTunnelProvider } from './base';

export type LocaltunnelOptions = {
  subdomain?: string;
};

export class LocaltunnelProvider extends BaseTunnelProvider {
  private tunnel: Tunnel | null = null;

  constructor(private readonly options: LocaltunnelOptions = {}) {
    super('localtunnel');
  }

  async start(localPort: number): Promise<string> {
    this.tunnel = await localtunnel({
      port: localPort,
      subdomain: this.options.subdomain,
    });

    this.tunnel.on('close', () => {
      this.logger.warn('localtunnel disconnected');
      this.disconnectedCallback?.();
    });

    this.tunnel.on('error', (err) => {
      this.logger.error('localtunnel error', { error: err.message });
    });

    this.logger.info('localtunnel started', { url: this.tunnel.url });
    return this.tunnel.url;
  }

  async stop(): Promise<void> {
    this.tunnel?.close();
    this.tunnel = null;
  }
}
