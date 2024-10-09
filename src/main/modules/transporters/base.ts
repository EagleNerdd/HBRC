import { createLogger, Logger } from '@main/logging';

export interface Transporter {
  getName(): string;
  connect(): void;
  disconnect(): void;
  send(data: any): Promise<void>;
  onReceive(cb: (data: any) => Promise<void>): void;
  onConnected(cb: () => Promise<void>): void;
}

export abstract class BaseTransporter implements Transporter {
  protected onReceiveCallback: (data: any) => Promise<void>;
  protected onConnectedCallback: () => Promise<void>;

  protected logger: Logger;

  constructor(protected name: string) {
    this.logger = createLogger(`transporter.${name}`, 'debug');
    this.logger.debug('created');
  }

  getName(): string {
    return this.name;
  }

  protected _connect(): void {
    throw new Error('Method not implemented.');
  }

  protected _disconnect(): void {
    throw new Error('Method not implemented.');
  }

  connect(): void {
    this._connect();
  }
  disconnect(): void {
    this._disconnect();
  }
  send(data: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
  onReceive(cb: (data: any) => Promise<void>) {
    this.onReceiveCallback = cb;
  }
  onConnected(cb: () => Promise<void>): void {
    this.onConnectedCallback = cb;
  }
}
