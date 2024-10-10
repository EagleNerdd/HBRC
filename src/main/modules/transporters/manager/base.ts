import { IncommingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
import {
  DummyTransporter,
  HttpTransporter,
  HttpTransporterOptions,
  MqttTransporter,
  MqttTransporterOptions,
  Transporter,
} from '../backend';
import { Logger } from '@main/logging';
import { ClientEvents } from 'main/modules/events';
import { TransporterStatus } from 'shared/types/transporter';

export enum TransporterType {
  HTTP = 'http',
  MQTT = 'mqtt',
  DUMMY = 'dummy',
}

export type TransporterOptions = HttpTransporterOptions | MqttTransporterOptions;

export type TransportersOptions = {
  [key: string]: {
    type: TransporterType;
    options: TransporterOptions;
    isDefault?: boolean;
  };
};

export interface TransporterManager {
  init(): Promise<void>;
  createTransporter(name: string, type: TransporterType, options?: TransporterOptions): Transporter;
  getTransporter(name?: string): Transporter;
  close(): void;
  getStatus(): TransporterStatus;
}

export interface TransporterMessaging {
  sendMessage(message: OutgoingTransportMessage, options?: { transporter?: string }): Promise<void>;
  onMessageReceived(cb: (message: IncommingTransportMessage) => Promise<void>): void;
}

export class BaseTransporterManager implements TransporterManager {
  protected transporters: { [key: string]: Transporter } = {};
  protected defaultTransporterStatus: TransporterStatus = 'disconnected';
  protected logger: Logger;

  constructor(protected readonly clientEvents: ClientEvents) {
    this.clientEvents.onTransporterStatusChanged.listen((status) => {
      this.defaultTransporterStatus = status;
    });
  }

  getStatus(): TransporterStatus {
    return this.defaultTransporterStatus;
  }

  createTransporter(name: string, type: TransporterType, options?: TransporterOptions): Transporter {
    let transporter: Transporter;
    if (type === TransporterType.HTTP) {
      transporter = new HttpTransporter(name, options as HttpTransporterOptions);
    } else if (type == TransporterType.MQTT) {
      transporter = new MqttTransporter(name, options as MqttTransporterOptions);
    } else if (type == TransporterType.DUMMY) {
      transporter == new DummyTransporter(name);
    }
    this.transporters[name] = transporter;
    return transporter;
  }
  getTransporter(name: string): Transporter {
    return this.transporters[name];
  }
  async init() {}

  get defaultTransporter() {
    return this.transporters['default'];
  }

  close(): void {
    for (const [k, transporter] of Object.entries(this.transporters)) {
      transporter.disconnect();
      if (k == 'default') {
        this.clientEvents.onTransporterStatusChanged.emit('disconnected');
      }
    }
  }
}
