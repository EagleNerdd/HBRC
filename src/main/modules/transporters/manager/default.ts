import { IncomingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
import { BaseTransporterManager, TransporterMessaging } from './base';
import { Queue } from '@shared/queue/base';
import { FileQueue } from '@main/modules/queue';
import { ClientEvents } from '@main/modules/events';
import { getDataPath } from '@main/utils';

export class DefaultTransporterManager extends BaseTransporterManager implements TransporterMessaging {
  private ttcMessagesQueue: Queue; // TransporterToController: this queue pass message from transporter to controller
  private cttMessagesQueue: Queue; // ControllerToTransporter: this queue pass message from controller to transporter

  constructor(clientEvents: ClientEvents) {
    super(clientEvents);
    this.ttcMessagesQueue = new FileQueue(getDataPath('message_queues', 'ttc'), {
      name: 'ttc',
      messageMaxRequeueNumber: 20,
    });
    this.cttMessagesQueue = new FileQueue(getDataPath('message_queues', 'ctt'), {
      name: 'ctt',
    });
  }

  async sendMessage(message: OutgoingTransportMessage, options?: { transporter?: string }): Promise<void> {
    await this.cttMessagesQueue.push({ message, transporter: options?.transporter });
  }

  onMessageReceived(cb: (message: IncomingTransportMessage) => Promise<void>): void {
    this.ttcMessagesQueue.onMessage(cb);
  }

  async init() {
    const defaultTransporter = this.defaultTransporter;
    if (!defaultTransporter) {
      throw new Error('Default transporter not found');
    }
    this.clientEvents.onTransporterStatusChanged.emit('connecting');

    // Register processing callbacks before starting queues
    this.cttMessagesQueue.onMessage(async (data: { message: OutgoingTransportMessage; transporter?: string }) => {
      let transporter = defaultTransporter;
      if (data.transporter) {
        transporter = this.getTransporter(data.transporter);
      }
      if (transporter) {
        await transporter.send(data.message);
      } else {
        throw new Error('Not found transporter');
      }
    });

    // Start queues before connecting transporter to avoid push() before start()
    this.ttcMessagesQueue.start();
    this.cttMessagesQueue.start();

    // Register transporter callbacks and connect after queues are ready
    defaultTransporter.onConnected(async () => {
      this.clientEvents.onTransporterStatusChanged.emit('connected');
    });
    defaultTransporter.onReceive(async (message: IncomingTransportMessage) => {
      if (message.controlInstance || message.manageInstance) {
        await this.ttcMessagesQueue.push(message);
      } else {
        this.logger.warn('Unknown message type', { message });
      }
    });

    defaultTransporter.connect();
    for (const [k, v] of Object.entries(this.transporters)) {
      if (k != 'default') {
        v.connect();
      }
    }
  }

  close(): void {
    (this.ttcMessagesQueue as FileQueue).stop();
    (this.cttMessagesQueue as FileQueue).stop();
    super.close();
  }
}
