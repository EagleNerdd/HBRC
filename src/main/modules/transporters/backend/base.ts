import { createLogger, Logger } from '@main/logging';
import { OutgoingTransportMessage } from '@shared/types/message';

export interface Transporter {
  getName(): string;
  connect(): void;
  disconnect(): void;
  send(data: OutgoingTransportMessage): Promise<void>;
  onReceive(cb: (data: any) => Promise<void>): void;
  onConnected(cb: () => Promise<void>): void;
}

export type BaseTransporterOptions = {
  extraData?: any;
};

export abstract class BaseTransporter implements Transporter {
  protected onReceiveCallback: (data: any) => Promise<void>;
  protected onConnectedCallback: () => Promise<void>;

  protected logger: Logger;

  constructor(protected name: string, protected readonly options?: BaseTransporterOptions) {
    this.logger = createLogger(`transporter.${name}`, 'info');
  }

  getMessageExtraData() {
    return this.options.extraData;
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

  _send(data: OutgoingTransportMessage): Promise<void> {
    throw new Error('Method not implemented.');
  }

  send(data: OutgoingTransportMessage): Promise<void> {
    const extra = this.getMessageExtraData();
    if (extra) {
      data.extra = extra;
    }
    return this._send(data);
  }
  onReceive(cb: (data: any) => Promise<void>) {
    this.onReceiveCallback = cb;
  }
  onConnected(cb: () => Promise<void>): void {
    this.onConnectedCallback = cb;
  }
}
