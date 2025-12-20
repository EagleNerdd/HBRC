import { KVStorage } from '@shared/storages/kvStorage';
import { ClientKvStorage, ElectronKvStorage } from '@main/modules/storages/kvStorage';
import { ClientEvents } from '@main/modules/events';
import BrowserInstanceManager from '@main/modules/instances/manager';
import { app, BrowserWindow, App as ElectronApp } from 'electron';
import getPort from 'get-port';
import retry from 'async-retry';
import puppeteer, { Browser } from 'puppeteer-core';

import { makeAppSetup } from '../factories';
import { MainWindow } from '../windows';
import { registerIPCs } from '../ipcs';
import {
  ON_APPLICATION_READY,
  ON_INSTANCE_MESSAGE,
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
import { createLogger, Logger, setLoggerLevel } from '@main/logging';
import { isDebugging, setDebugging, updateUserAgents } from '@main/utils';

class Application implements HBRCApplication {
  private events: ClientEvents;
  private kvStorage: KVStorage;
  private clientKvStorage: ClientKvStorage;
  private instanceManager: BrowserInstanceManager;
  private transporterManager: TransporterManager;
  private transporterMessaging: TransporterMessaging;
  private browser?: Browser;
  private _isReady = false;
  private agentName: string;
  private logger: Logger;
  private mainWindow?: BrowserWindow;
  constructor(private readonly eApp: ElectronApp, private options: HBRCAppOptions) {
    this.logger = createLogger('app');
    this.kvStorage = new ElectronKvStorage();
    this.clientKvStorage = new ClientKvStorage(this.kvStorage);
    this.events = new ClientEvents();
    const transporterManager = new DefaultTransporterManager(this.events);
    this.transporterManager = transporterManager;
    this.transporterMessaging = transporterManager;
    this.instanceManager = new BrowserInstanceManager(this.transporterMessaging, this.events);
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
    await this.setupPuppeteerBeforeAppReady();
    await this.initElectronApp();
    await this.connectPuppeteerAfterAppReady();
    await this.instanceManager.init(this.browser!);
    await this.initOptions();
    await updateUserAgents();
    this._isReady = true;
    this.events.onClientReady.emit();
  }

  private async setupPuppeteerBeforeAppReady(): Promise<void> {
    if (this.eApp.isReady()) {
      throw new Error('Must be called at startup before the electron app is ready.');
    }
    const actualPort = await getPort({ host: '127.0.0.1', port: 9219 });
    this.eApp.commandLine.appendSwitch('remote-debugging-port', `${actualPort}`);
    this.eApp.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  }

  private async connectPuppeteerAfterAppReady(): Promise<void> {
    if (!this.eApp.isReady()) {
      throw new Error('Please connect after the app is ready.');
    }
    if (!puppeteer) {
      throw new Error("The parameter 'puppeteer' was not passed in.");
    }
    const port = this.eApp.commandLine.getSwitchValue('remote-debugging-port');
    if (!port) {
      throw new Error('Please call initialize before calling connect.');
    }
    const debuggerUrl = await retry(() => this.getAppDebuggerUrl(port));
    this.browser = await puppeteer.connect({
      browserWSEndpoint: debuggerUrl,
      defaultViewport: null,
    });
  }

  private async getAppDebuggerUrl(port: string): Promise<string> {
    const response = await fetch(`http://127.0.0.1:${port}/json/version?t=${Math.random()}`);
    const debugEndpoints = await response.json();
    return debugEndpoints.webSocketDebuggerUrl;
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
    this.events.onInstanceMessage.listen((data) => {
      this.sendMainWindowEvent(ON_INSTANCE_MESSAGE, data);
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
    if (storageDebug) {
      setLoggerLevel('debug');
    }
    setDebugging(storageDebug);
  }
}

export { Application };
