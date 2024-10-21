import { IncommingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
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
      messageMaxRequeueNumber: 10,
    });
    this.cttMessagesQueue = new FileQueue(getDataPath('message_queues', 'ctt'));
  }

  async sendMessage(message: OutgoingTransportMessage, options?: { transporter?: string }): Promise<void> {
    await this.cttMessagesQueue.push({ message, transporter: options?.transporter });
  }

  onMessageReceived(cb: (message: IncommingTransportMessage) => Promise<void>): void {
    this.ttcMessagesQueue.onMessage(cb);
  }

  async init() {
    const defaultTransporter = this.defaultTransporter;
    if (!defaultTransporter) {
      throw new Error('Default transporter not found');
    }
    this.clientEvents.onTransporterStatusChanged.emit('connecting');
    defaultTransporter.connect();
    defaultTransporter.onConnected(async () => {
      this.clientEvents.onTransporterStatusChanged.emit('connected');
    });
    defaultTransporter.onReceive(async (message: IncommingTransportMessage) => {
      if (message.controlInstance || message.manageInstance) {
        await this.ttcMessagesQueue.push(message);
      } else {
        this.logger.warn('Unknown message type', { message });
      }
    });
    this.cttMessagesQueue.onMessage(async (data: { message: OutgoingTransportMessage; transporter?: string }) => {
      let transporter = defaultTransporter;
      if (data.transporter) {
        transporter = this.getTransporter(data.transporter);
      }
      if (transporter) {
        let message = data.message;
        await transporter.send(message);
      } else {
        throw new Error('Not found transporter');
      }
    });
    this.ttcMessagesQueue.start();
    this.cttMessagesQueue.start();

    for (const [k, v] of Object.entries(this.transporters)) {
      if (k != 'default') {
        v.connect();
      }
    }
  }
}
