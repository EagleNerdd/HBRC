import { FSDB } from 'file-system-db';
import { BrowserInstanceController } from './controllers';
import { Browser } from 'puppeteer-core';
import { BrowserInstance, BrowserInstanceStatus, BrowserInstanceType } from '@shared/types';
import { IncomingTransportMessage, OutgoingTransportMessage } from '@shared/types/message';
import { createLogger, Logger } from '@main/logging';
import { ClientEvents } from '../events';
import { TransporterMessaging } from '../transporters';
import { getDataPath } from '@main/utils';
import { ENVIRONMENT } from '@shared/constants';
import { createInstanceController } from './controllers/factory';

class BrowserInstanceManager {
  private db: FSDB;
  private channelControllerMap = new Map<string, BrowserInstanceController>();
  private instanceRuntimeStateMap = new Map<string, {
    status?: BrowserInstanceStatus,
    headless?: boolean,
  }>();
  private logger: Logger;
  private browser?: Browser;

  constructor(
    private readonly transporterMessaging: TransporterMessaging,
    private readonly clientEvents: ClientEvents,
  ) {
    this.logger = createLogger('browserInstanceManager');
  }

  async init(browser: Browser) {
    this.browser = browser;
    const dbFileName = ENVIRONMENT.IS_LOCAL ? 'instances.local.json' : 'instances.json';
    const dbPath = getDataPath(dbFileName);
    this.logger.debug('init', { dbPath });
    this.db = new FSDB(dbPath, true);
    this.clientEvents.onInstanceUpdated.listen(({ sessionId, updated }) => {
      let data = this.instanceRuntimeStateMap.get(sessionId) ?? {};
      if (updated.status) {
        data = { ...data, status: updated.status };
      }
      if (typeof updated.headless !== 'undefined') {
        data = { ...data, headless: updated.headless };
      }
      this.logger.debug('onInstanceUpdated', { updated, data });
      this.instanceRuntimeStateMap.set(sessionId, data);
    });
    this.transporterMessaging.onMessageReceived(this.processTransportMessage.bind(this));
  }

  private async processTransportMessage(data: IncomingTransportMessage) {
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

  private async handleManageInstanceMessage(data: IncomingTransportMessage['manageInstance']) {
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
    const data = this.instanceRuntimeStateMap.get(bi.sessionId);
    this.logger.debug('finalizeInstanceData', { data });
    bi.status = data?.status || 'Stopped';
    bi.headless = data?.headless;
    return bi;
  }

  async getInstances() {
    return this.db.getAll().map((e) => {
      return this.finalizeInstanceData(e.value);
    });
  }

  async getRunningInstanceSessionIdSet() {
    return new Set(this.channelControllerMap.keys());
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
      this.channelControllerMap.delete(sessionId);
    }
    this.emitInstanceUpdatedEvent(sessionId, { status: 'Stopped' });
  }

  async addInstance(name: string, url: string, type: BrowserInstanceType) {
    const bi: BrowserInstance = {
      name,
      sessionId: '',
      url,
      type,
    };
    await this.createInstanceController(bi, { show: true, hideOnClose: true });
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

  async showInstanceWindow(sessionId: string) {
    const controller = this.getController(sessionId);
    if (controller?.showWindow) {
      await controller.showWindow();
    }
  }

  async hideInstanceWindow(sessionId: string) {
    const controller = this.getController(sessionId);
    if (controller?.hideWindow) {
      await controller.hideWindow();
    }
  }

  private async loadInstanceWindowPage(bi: BrowserInstance) {
    if (this.channelControllerMap.has(bi.sessionId)) {
      return;
    }
    this.emitInstanceUpdatedEvent(bi.sessionId, { status: 'Starting' });
    await this.createInstanceController(bi, {
      show: false,
      hideOnClose: true,
      identifier: bi.sessionId,
    });
    this.logger.debug('loadInstanceWindowPage', bi);
  }

  private async createInstanceController(
    bi: BrowserInstance,
    options?: {
      show?: boolean;
      hideOnClose?: boolean;
      identifier?: string;
    },
  ) {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    const controller = await createInstanceController(this.browser, bi, this.transporterMessaging, this.clientEvents, options);
    this.channelControllerMap.set(bi.sessionId, controller);
    await controller.init();
    this.emitInstanceUpdatedEvent(bi.sessionId, { status: 'Running' });
    return controller;
  }

  private saveInstance(bi: BrowserInstance) {
    this.db.set(bi.sessionId, bi);
  }

  async updateInstance(
    sessionId: string,
    bi: Partial<Pick<BrowserInstance, 'name' | 'initInstructions' | 'attributes'>>,
    options?: {
      restart?: boolean;
      notifyToTransporter?: boolean;
      notifyToRenderer?: boolean;
    },
  ) {
    const { restart = true, notifyToTransporter = false, notifyToRenderer = false } = options || {};
    const i = await this.getInstance(sessionId);
    if (!i) {
      throw new Error(`Instance not found: ${sessionId}`);
    }
    const newInstanceData = { ...i, ...bi };
    this.saveInstance(newInstanceData);
    const controller = this.getController(sessionId);
    if (controller) {
      await controller.setInstance(newInstanceData);
      if (restart) {
        await controller.restart();
      }
    }
    if (notifyToTransporter) {
      await this.pushMessageToTransporter('updateInstance', { instance: { ...bi, sessionId } });
    }
    if (notifyToRenderer) {
      this.emitInstanceUpdatedEvent(sessionId, bi);
    }
  }

  getController(sessionId: string) {
    return this.channelControllerMap.get(sessionId);
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
