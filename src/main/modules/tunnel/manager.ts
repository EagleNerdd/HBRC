import { createLogger } from '@main/logging';
import { TunnelProvider } from './providers/base';

export type TunnelManagerOptions = {
  providers: TunnelProvider[];
  retryDelayMs?: number;
};

export class TunnelManager {
  private logger = createLogger('tunnel.manager');
  private currentUrl: string | null = null;
  private urlChangedCallback: ((url: string | null) => void) | null = null;
  private stopped = false;
  private readonly retryDelayMs: number;

  constructor(
    private readonly localPort: number,
    private readonly options: TunnelManagerOptions
  ) {
    this.retryDelayMs = options.retryDelayMs ?? 60_000;
  }

  onUrlChanged(cb: (url: string | null) => void): void {
    this.urlChangedCallback = cb;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.logger.info('tunnel manager started', { localPort: this.localPort });
    await this.tryProviders(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled(this.options.providers.map((p) => p.stop()));
    this.currentUrl = null;
  }

  private async tryProviders(fromIndex: number): Promise<void> {
    if (this.stopped) return;

    for (let i = fromIndex; i < this.options.providers.length; i++) {
      const provider = this.options.providers[i];
      try {
        this.logger.info(`trying tunnel provider: ${provider.getName()}`);
        const url = await provider.start(this.localPort);

        this.currentUrl = url;
        this.urlChangedCallback?.(url);
        this.logger.info(`tunnel active via ${provider.getName()}`, { url });

        provider.onDisconnected(() => {
          if (this.stopped) return;
          this.logger.warn(`${provider.getName()} disconnected, trying next provider`);
          this.currentUrl = null;
          this.urlChangedCallback?.(null);
          this.tryProviders(i + 1);
        });

        return;
      } catch (err: any) {
        this.logger.warn(`${provider.getName()} failed: ${err.message}`);
      }
    }

    this.logger.error(`all tunnel providers failed, retrying in ${this.retryDelayMs}ms`);
    setTimeout(() => this.tryProviders(0), this.retryDelayMs);
  }
}
