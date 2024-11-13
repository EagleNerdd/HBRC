import { KVStorage } from '@shared/storages/kvStorage';
import { ClientKvStorage, ElectronKvStorage } from '@main/modules/storages/kvStorage';
import { ClientEvents } from '@main/modules/events';
import BrowserInstanceManager from '@main/modules/instances/manager';
import { app, BrowserWindow, App as ElectronApp } from 'electron';
import { PuppeteerElectron } from '../pie';

import { makeAppSetup } from '../factories';
import { MainWindow } from '../windows';
import { registerIPCs } from '../ipcs';
import {
  ON_APPLICATION_READY,
  ON_INSTANCE_UPDATED,
  ON_SERVER_DISCONNECTED,
  ON_TRANSPORTER_STATUS_CHANGED,
} from '@shared/constants/ipcs';
import { TransporterManager, DefaultTransporterManager, TransporterMessaging } from '@main/modules/transporters';
import { OutgoingTransportMessage } from '@shared/types/message';
import { getComputerName } from '@shared/utils/node';
import { initMenuForMainWindow } from '../menu';
import { MenuItemId } from '@shared/constants';
import { HBRCAppInfo, HBRCApplication, HBRCAppOptions } from './base';
import { createLogger, Logger } from '@main/logging';
import { isDebugging, setDebugging } from '@main/utils';

class Application implements HBRCApplication {
  private events: ClientEvents;
  private kvStorage: KVStorage;
  private clientKvStorage: ClientKvStorage;
  private instanceManager: BrowserInstanceManager;
  private transporterManager: TransporterManager;
  private transporterMessaging: TransporterMessaging;
  private puppeteerElectron: PuppeteerElectron;
  private _isReady = false;
  private agentName: string;
  private logger: Logger;
  private mainWindow?: BrowserWindow;
  constructor(private readonly eApp: ElectronApp, private options: HBRCAppOptions) {
    this.logger = createLogger('app', 'debug');
    this.kvStorage = new ElectronKvStorage();
    this.clientKvStorage = new ClientKvStorage(this.kvStorage);
    this.events = new ClientEvents();
    this.puppeteerElectron = new PuppeteerElectron();
    const transporterManager = new DefaultTransporterManager(this.events);
    this.transporterManager = transporterManager;
    this.transporterMessaging = transporterManager;
    this.instanceManager = new BrowserInstanceManager(this.puppeteerElectron, this.transporterMessaging, this.events);
    this.agentName = getComputerName();
    this.events.onTransporterStatusChanged.listen(async (status) => {
      if (status == 'connected') {
        await this.pushAgentMessageToTransporter('info', { name: this.agentName });
        await this.instanceManager.pushListInstanceMessage();
      }
    });
  }

  getEvents() {
    return this.events;
  }

  async getAppInfo(): Promise<HBRCAppInfo> {
    return {
      options: this.options,
      transporterStatus: this.transporterManager.getStatus(),
      version: app.getVersion(),
      userPath: app.getPath('userData'),
      isDebug: isDebugging(),
    };
  }

  async setOptions(options: HBRCAppOptions, save = true) {
    this.options = { ...this.options, ...options };
    this.logger.debug('setOptions', { options });
    await this.initTransporters();
    if (save) {
      await this.clientKvStorage.setItem('applicationOptions', this.options);
    }
    this.setMainWindowMenuVisibilityOnConnected();
  }

  private setMainWindowMenuVisibilityOnConnected() {
    if (this.mainWindow) {
      initMenuForMainWindow(app, this, this.mainWindow);
    }
  }

  private setMainWindowMenuVisibilityOnDisconnected() {
    if (this.mainWindow) {
      initMenuForMainWindow(app, this, this.mainWindow, {
        excludeMenuItemIds: [MenuItemId.SERVER, MenuItemId.MANAGE],
      });
    }
  }

  private async initTransporters() {
    if (!this.options.transporters || !Object.keys(this.options.transporters).length) {
      return;
    }
    for (const [name, transporter] of Object.entries(this.options.transporters)) {
      this.transporterManager.createTransporter(name, transporter.type, transporter.options);
    }
    await this.transporterManager.init();
  }

  private async pushAgentMessageToTransporter(action: OutgoingTransportMessage['agent']['action'], payload: any) {
    const msg: OutgoingTransportMessage = {
      agent: {
        action: action,
        payload: payload,
      },
    };
    await this.transporterMessaging.sendMessage(msg, { transporter: 'default' });
  }

  private async initOptions() {
    const ops = await this.clientKvStorage.getItem('applicationOptions');
    if (ops) {
      await this.setOptions(ops, false);
    }
  }

  async init() {
    await this.initDebugMode();
    await this.puppeteerElectron.beforeAppReady();
    await this.initElectronApp();
    await this.puppeteerElectron.afterAppReady();
    await this.instanceManager.init();
    await this.initOptions();
    this._isReady = true;
    this.events.onClientReady.emit();
  }

  sendMainWindowEvent(event: string, data?: any) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  async initElectronApp() {
    await this.eApp.whenReady();
    registerIPCs(this);
    const mainWindow = await makeAppSetup(() => {
      return MainWindow(this);
    });
    this.mainWindow = mainWindow;
    this.initEventListeners();
  }

  private initEventListeners() {
    this.events.onClientReady.listen(() => {
      this.sendMainWindowEvent(ON_APPLICATION_READY);
    });
    this.events.onTransporterStatusChanged.listen((status) => {
      this.sendMainWindowEvent(ON_TRANSPORTER_STATUS_CHANGED, status);
    });
    this.events.onInstanceUpdated.listen((data) => {
      this.sendMainWindowEvent(ON_INSTANCE_UPDATED, data);
    });
  }

  async disconnectServer() {
    this.options = {};
    this.clientKvStorage.delItem('applicationOptions');
    this.transporterManager.close();
    this.events.onTransporterStatusChanged.emit('disconnected');
    this.sendMainWindowEvent(ON_SERVER_DISCONNECTED);
    this.setMainWindowMenuVisibilityOnDisconnected();
  }

  getInstanceManager() {
    if (!this._isReady) {
      throw new Error('Application not ready');
    }
    return this.instanceManager;
  }

  getPuppeteerElectron() {
    if (!this._isReady) {
      throw new Error('Application not ready');
    }
    return this.puppeteerElectron;
  }

  setDebugMode(isEnableDebug: boolean): void {
    const _isDebugging = isDebugging();
    if (isEnableDebug && _isDebugging) {
      return;
    }
    if (!isEnableDebug && !_isDebugging) {
      return;
    }
    setDebugging(isEnableDebug);
    this.clientKvStorage.setItem('isDebug', isEnableDebug).then(() => {
      this.eApp.relaunch();
      this.eApp.quit();
    });
  }

  async initDebugMode() {
    const storageDebug = !!(await this.clientKvStorage.getItem('isDebug'));
    setDebugging(storageDebug);
  }
}

export { Application };
