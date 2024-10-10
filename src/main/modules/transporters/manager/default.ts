import path from 'path';
import { app as electonApp } from 'electron';
import { IncommingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
import { BaseTransporterManager, TransporterMessaging } from './base';
import { Queue } from '@shared/queue/base';
import { FileQueue } from '@main/modules/queue';
import { ClientEvents } from '@main/modules/events';

export class DefaultTransporterManager extends BaseTransporterManager implements TransporterMessaging {
  private ttcMessagesQueue: Queue; // TransporterToController: this queue pass message from transporter to controller
  private cttMessagesQueue: Queue; // ControllerToTransporter: this queue pass message from controller to transporter

  constructor(clientEvents: ClientEvents) {
    super(clientEvents);
    this.ttcMessagesQueue = new FileQueue(path.join(electonApp.getAppPath(), 'out', 'data', 'message_queues', 'ttc'), {
      messageMaxRequeueNumber: 10,
    });
    this.cttMessagesQueue = new FileQueue(path.join(electonApp.getAppPath(), 'out', 'data', 'message_queues', 'ctt'));
  }

  async sendMessage(message: OutgoingTransportMessage, options?: { transporter?: string }): Promise<void> {
    await this.cttMessagesQueue.push({ message, transporter: options?.transporter });
  }

  onMessageReceived(cb: (message: IncommingTransportMessage) => Promise<void>): void {
    this.ttcMessagesQueue.onMessage(cb);
  }

  private async initDefaultTransporter() {
    const defaultTransporter = this.defaultTransporter;
    if (defaultTransporter) {
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
          await transporter.send(data.message);
        } else {
          throw new Error('Not found transporter');
        }
      });
      this.ttcMessagesQueue.start();
      this.cttMessagesQueue.start();
    } else {
      throw new Error('Default transporter not found');
    }
  }

  async init() {
    await this.initDefaultTransporter();
    for (const [k, v] of Object.entries(this.transporters)) {
      if (k != 'default') {
        v.connect();
      }
    }
  }
}
