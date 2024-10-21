import { FSDB } from 'file-system-db';
import { PuppeteerElectron } from '@main/pie';
import { PuppeteerInstanceController, BrowserInstanceController } from './controllers';
import { Page } from 'puppeteer-core';
import { BrowserInstance, BrowserInstanceStatus } from '@shared/types';
import { IncommingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
import { Logger, createLogger } from '@main/logging';
import { ClientEvents } from '../events';
import { TransporterMessaging } from '../transporters';
import { getDataPath } from '@main/utils';

class BrowserInstanceManager {
  private db: FSDB;
  private channelControlllerMap = new Map<string, BrowserInstanceController>();
  private instanceStatusMap = new Map<string, BrowserInstanceStatus>();
  private logger: Logger;
  constructor(
    private readonly pie: PuppeteerElectron,
    private readonly transporterMessaging: TransporterMessaging,
    private readonly clientEvents: ClientEvents
  ) {
    this.logger = createLogger('browserInstanceManager', 'debug');
  }

  async init() {
    const dbPath = getDataPath('instances.json');
    this.logger.debug('init', { dbPath });
    this.db = new FSDB(dbPath, true);
    this.clientEvents.onInstanceUpdated.listen(({ sessionId, updated }) => {
      if (updated.status) {
        this.instanceStatusMap.set(sessionId, updated.status);
      }
    });
    this.transporterMessaging.onMessageReceived(this.processTransportMessage.bind(this));
  }

  private async processTransportMessage(data: IncommingTransportMessage) {
    this.logger.debug('processTransportMessage', { data });
    if (data.controlInstance) {
      const { sessionId, instructions } = data.controlInstance;
      const controller = this.getController(sessionId);
      if (controller) {
        await controller.executeInstructions(instructions);
      }
    } else if (data.manageInstance) {
      await this.handleManageInstanceMessage(data.manageInstance);
    }
  }

  private async handleManageInstanceMessage(data: IncommingTransportMessage['manageInstance']) {
    this.logger.debug('handleManageInstanceMessage', { data });
    const { action, payload } = data;
    if (action == 'updateInstance') {
      if (!payload) {
        return;
      }
      const { sessionId } = payload;
      if (!sessionId) {
        return;
      }
      const bi = await this.getInstance(sessionId);
      if (!bi) {
        this.logger.error(`Instance not found: ${sessionId}`);
      } else {
        await this.updateInstance(sessionId, payload);
      }
    }
  }

  private finalizeInstanceData(bi: BrowserInstance) {
    if (!bi) {
      return bi;
    }
    bi.status = this.instanceStatusMap.get(bi.sessionId) || 'Stopped';
    return bi;
  }

  async getInstances() {
    return this.db.getAll().map((e) => {
      return this.finalizeInstanceData(e.value);
    });
  }

  async getRunningInstanceSessionIdSet() {
    return new Set(this.channelControlllerMap.keys());
  }

  async getInstance(sessionId: string) {
    const instance = this.db.get(sessionId);
    return this.finalizeInstanceData(instance);
  }

  async startInstance(sessionId: string) {
    const instance = await this.getInstance(sessionId);
    if (!instance) {
      throw new Error(`Instance not found: ${sessionId}`);
    }
    await this.loadInstanceWindowPage(instance);
  }

  async startAllInstances() {
    const instances = await this.getInstances();
    for (const instance of instances) {
      await this.loadInstanceWindowPage(instance);
    }
  }

  async stopAllInstances() {
    const instances = await this.getInstances();
    for (const instance of instances) {
      await this.stopInstance(instance.sessionId);
    }
  }

  private emitInstanceUpdatedEvent(sessionId: string, updated: Partial<BrowserInstance>) {
    this.clientEvents.onInstanceUpdated.emit({ sessionId, updated });
  }

  async stopInstance(sessionId: string) {
    this.emitInstanceUpdatedEvent(sessionId, { status: 'Stopping' });
    const controller = this.getController(sessionId);
    if (controller) {
      await controller.destroy();
      await this.pie.closeWindow(sessionId);
      this.channelControlllerMap.delete(sessionId);
    }
    this.emitInstanceUpdatedEvent(sessionId, { status: 'Stopped' });
  }

  async addInstance(name: string, url: string) {
    const { sessionId, page } = await this.openAddChannelWindownPage(url);
    const bi: BrowserInstance = {
      name,
      sessionId,
      url,
    };
    await this.createInstanceController(bi, page);
    this.saveInstance(bi);
    await this.pushMessageToTransporter('addInstance', { instance: bi });
  }

  async removeInstance(sessionId: string) {
    this.db.delete(sessionId);
    await this.pushMessageToTransporter('removeInstance', { instance: { sessionId } });
  }

  private async pushMessageToTransporter(action: OutgoingTransportMessage['instanceManager']['action'], payload: any) {
    const msg: OutgoingTransportMessage = {
      instanceManager: {
        action,
        payload,
      },
    };
    this.transporterMessaging.sendMessage(msg, { transporter: 'default' });
  }

  async pushListInstanceMessage() {
    await this.pushMessageToTransporter('listInstance', {
      instances: await this.getInstances(),
    });
  }

  private async openAddChannelWindownPage(url: string) {
    const { window, page, identifier } = await this.pie.newWindowPage(url, undefined, {
      show: true,
      hideOnClose: true,
    });
    return { window, page, sessionId: identifier };
  }

  async showInstanceWindow(sessionId: string) {
    const { window } = this.pie.getWindowPage(sessionId) || {};
    if (window) window.show();
  }

  private async loadInstanceWindowPage(bi: BrowserInstance) {
    if (this.channelControlllerMap.has(bi.sessionId)) {
      return;
    }
    this.emitInstanceUpdatedEvent(bi.sessionId, { status: 'Starting' });
    const { page } = await this.pie.newWindowPage(bi.url, bi.sessionId, {
      show: false,
      hideOnClose: true,
    });
    await this.createInstanceController(bi, page);
    this.logger.debug('loadInstanceWindowPage', bi);
  }

  private async createInstanceController(bi: BrowserInstance, page: Page) {
    const controller = new PuppeteerInstanceController(bi, this.transporterMessaging, page);
    this.channelControlllerMap.set(bi.sessionId, controller);
    await controller.init();
    this.emitInstanceUpdatedEvent(bi.sessionId, { status: 'Running' });
    return controller;
  }

  private saveInstance(bi: BrowserInstance) {
    this.db.set(bi.sessionId, bi);
  }

  async updateInstance(sessionId: string, bi: Partial<Pick<BrowserInstance, 'name' | 'initInstructions'>>) {
    const i = await this.getInstance(sessionId);
    if (!i) {
      throw new Error(`Instance not found: ${sessionId}`);
    }
    const newInstanceData = { ...i, ...bi };
    this.saveInstance(newInstanceData);
    const controller = this.getController(sessionId);
    if (controller) {
      await controller.setInstance(newInstanceData);
    }
  }

  getController(sessionId: string) {
    return this.channelControlllerMap.get(sessionId);
  }

  async callInstanceFunction(sessionId: string, method: string, ...args: any[]) {
    const controller = this.getController(sessionId);
    if (!controller) {
      throw new Error(`Controller not found for session: ${sessionId}`);
    }
    const func = controller[method].bind(controller);
    return await func(...args);
  }
}

export default BrowserInstanceManager;
