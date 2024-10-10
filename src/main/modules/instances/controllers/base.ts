import { BrowserInstance, BrowserInstanceInstruction } from '@shared/types';
import { OutgoingTransportMessage } from '@shared/types/message';
import { TransporterMessaging } from '@main/modules/transporters';

export interface BrowserInstanceController {
  browserEval(code: string): Promise<any>;
  init(): Promise<void>;
  postMessage(data: any): Promise<void>;
  executeInstructions(instructions: BrowserInstanceInstruction[]): Promise<any>;
  executeInstruction(instruction: BrowserInstanceInstruction): Promise<any>;
  setInstance(instance: BrowserInstance): Promise<void>;
  destroy(): Promise<void>;
}

export abstract class BaseBrowserInstanceController implements BrowserInstanceController {
  constructor(protected instance: BrowserInstance, protected readonly transporterMessaging: TransporterMessaging) {}

  async setInstance(instance: BrowserInstance) {
    this.instance = instance;
  }

  executeInstructions(instructions: BrowserInstanceInstruction[]): Promise<any> {
    throw new Error('Method not implemented.');
  }
  executeInstruction(instruction: BrowserInstanceInstruction): Promise<any> {
    throw new Error('Method not implemented.');
  }

  browserEval(code: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async postMessage(data: any, options?: { transporter?: string }) {
    const msg: OutgoingTransportMessage = {
      browserInstance: {
        sessionId: this.instance.sessionId,
        url: this.instance.url,
        action: 'postMessage',
        payload: data,
      },
    };
    await this.transporterMessaging.sendMessage(msg, options);
  }

  init(): Promise<void> {
    throw new Error('Method not implemented');
  }

  async destroy() {
    throw new Error('Method not implemented');
  }
}
