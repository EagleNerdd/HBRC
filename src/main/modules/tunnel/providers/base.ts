import { createLogger, Logger } from '@main/logging';

export interface TunnelProvider {
  getName(): string;
  start(localPort: number): Promise<string>;
  stop(): Promise<void>;
  onDisconnected(cb: () => void): void;
}

export abstract class BaseTunnelProvider implements TunnelProvider {
  protected disconnectedCallback: () => void;
  protected logger: Logger;

  constructor(protected readonly name: string) {
    this.logger = createLogger(`tunnel.${name}`);
  }

  getName(): string {
    return this.name;
  }

  onDisconnected(cb: () => void): void {
    this.disconnectedCallback = cb;
  }

  abstract start(localPort: number): Promise<string>;
  abstract stop(): Promise<void>;
}
