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
import { TransporterManager, DefaultTransporterManager, TransporterMessaging } from '@main/modules/transporters';
import { OutgoingTransportMessage } from '@shared/types';
import { HttpServer } from '@main/modules/http';
import {
  TunnelManager,
  TunnelProvider,
  LocaltunnelProvider,
  DevTunnelProvider,
  CloudflareTunnelProvider,
  FrpTunnelProvider,
} from '@main/modules/tunnel';
import { DownloadManager } from '@main/modules/downloader';
import {
  ENVIRONMENT,
  MenuItemId,
  ON_APPLICATION_READY,
  ON_INSTANCE_MESSAGE,
  ON_INSTANCE_UPDATED,
  ON_SERVER_DISCONNECTED,
  ON_TRANSPORTER_STATUS_CHANGED,
} from '@shared/constants';
import { getComputerName } from '@shared/utils/node';
import { initMenuForMainWindow } from '../menu';
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
  private httpServer: HttpServer;
  private httpServerPort: number;
  private tunnelManager: TunnelManager | null = null;
  private downloadManager: DownloadManager;
  private browser?: Browser;
  private _isReady = false;
  private agentName: string;
  private logger: Logger;
  private mainWindow?: BrowserWindow;
  constructor(
    private readonly eApp: ElectronApp,
    private options: HBRCAppOptions
  ) {
    this.logger = createLogger('app');
    this.kvStorage = new ElectronKvStorage();
    this.clientKvStorage = new ClientKvStorage(this.kvStorage);
    this.events = new ClientEvents();
    const transporterManager = new DefaultTransporterManager(this.events);
    this.transporterManager = transporterManager;
    this.transporterMessaging = transporterManager;
    this.instanceManager = new BrowserInstanceManager(this.transporterMessaging, this.events);
    this.downloadManager = new DownloadManager(() => this.mainWindow);
    this.agentName = getComputerName();
    this.events.onTransporterStatusChanged.listen(async (status) => {
      if (status == 'connected') {
        await this.pushAgentInfoToTransporter();
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

  async pushAgentInfoToTransporter(extra?: { tunnelUrl?: string | null }) {
    const info = {
      version: app.getVersion(),
      name: this.agentName,
      tunnelUrl: this.tunnelManager?.getCurrentUrl() ?? null,
      ...(extra || {}),
    };
    await this.pushAgentMessageToTransporter('info', info);
  }

  async setOptions(options: HBRCAppOptions, save = true) {
    this.options = { ...this.options, ...options };
    this.logger.debug('setOptions', { options });
    await this.initTransporters();
    if (save) {
      await this.clientKvStorage.setItem('applicationOptions', this.options);
    }
    // Tunnel init is driven from here so it runs both on app startup (via initOptions)
    // and when the user enters a new connection string.
    await this.initTunnelStateFromOptions();
    await this.initTunnelFromStorage();
    console.log('@@@Init xong nè');
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

  isTunnelActive(): boolean {
    return this.tunnelManager !== null;
  }

  async getTunnelState() {
    const [[isCloudflaredDownloaded, isFrpDownloaded], savedState] = await Promise.all([
      Promise.all([this.downloadManager.isDownloaded('cloudflared'), this.downloadManager.isDownloaded('frpc')]),
      this.clientKvStorage.getItem('tunnelState') as Promise<{ active: boolean; selectedProviders: string[] } | null>,
    ]);
    return {
      isActive: this.isTunnelActive(),
      currentUrl: this.tunnelManager?.getCurrentUrl() ?? null,
      selectedProviders: savedState?.selectedProviders ?? [],
      providers: [
        { name: 'frp', label: 'frp (frpc)', isDownloaded: isFrpDownloaded },
        { name: 'cloudflare', label: 'Cloudflare', isDownloaded: isCloudflaredDownloaded },
        { name: 'localtunnel', label: 'LocalTunnel', isDownloaded: true },
        ...(isDebugging() ? [{ name: 'devtunnel', label: 'Dev Tunnel', isDownloaded: true }] : []),
      ],
    };
  }

  async activateTunnel(selectedProviders: string[]): Promise<void> {
    if (this.tunnelManager) {
      await this.tunnelManager.stop();
      this.tunnelManager = null;
    }
    const [isCloudflaredDownloaded, isFrpDownloaded] = await Promise.all([
      this.downloadManager.isDownloaded('cloudflared'),
      this.downloadManager.isDownloaded('frpc'),
    ]);
    const cloudflaredBinPath = await this.downloadManager.getBinaryPath('cloudflared');
    const frpOptions = this.options.tunnels?.frp;

    const providers: TunnelProvider[] = [];
    for (const name of selectedProviders) {
      if (name === 'localtunnel') providers.push(new LocaltunnelProvider());
      else if (name === 'cloudflare' && isCloudflaredDownloaded)
        providers.push(new CloudflareTunnelProvider(cloudflaredBinPath));
      else if (name === 'frp' && isFrpDownloaded && frpOptions.serverAddr && frpOptions.remotePort)
        providers.push(new FrpTunnelProvider(frpOptions));
      else if (name === 'devtunnel') providers.push(new DevTunnelProvider());
    }

    this.tunnelManager = new TunnelManager(this.httpServerPort, { providers });
    this.tunnelManager.onUrlChanged(async (url) => {
      await this.pushAgentInfoToTransporter({ tunnelUrl: url });
    });
    await this.tunnelManager.start();
    await this.clientKvStorage.setItem('tunnelState', { active: true, selectedProviders });
    this.setMainWindowMenuVisibilityOnConnected();
  }

  async deactivateTunnel(): Promise<void> {
    if (this.tunnelManager) {
      await this.tunnelManager.stop();
      this.tunnelManager = null;
    }
    await this.clientKvStorage.setItem('tunnelState', { active: false, selectedProviders: [] });
    await this.pushAgentInfoToTransporter({ tunnelUrl: null });
    this.setMainWindowMenuVisibilityOnConnected();
  }

  private async initTunnelStateFromOptions(): Promise<void> {
    const existing = await this.clientKvStorage.getItem('tunnelState');
    if (existing) return;
    this.logger.debug('Not found tunnel state in storage, try get from options');
    const selectedProviders: string[] = [];
    for (const provider of Object.keys(this.options.tunnels || {})) {
      selectedProviders.push(provider);
    }
    this.logger.debug('Tunnel providers from options: ', selectedProviders);
    if (selectedProviders.length > 0) {
      await this.clientKvStorage.setItem('tunnelState', { active: true, selectedProviders });
    }
  }

  private async initTunnelFromStorage(): Promise<void> {
    const state = (await this.clientKvStorage.getItem('tunnelState')) as {
      active: boolean;
      selectedProviders: string[];
    } | null;
    if (state?.active && state.selectedProviders?.length > 0) {
      this.logger.debug('restoring tunnel from storage', { providers: state.selectedProviders });
      await this.activateTunnel(state.selectedProviders).catch((err) => {
        this.logger.error('failed to restore tunnel', { err: err.message });
      });
    }
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
    await this.initTunnelServer();
    await this.initOptions();
    await updateUserAgents();
    this._isReady = true;
    this.events.onClientReady.emit();
  }

  private async initTunnelServer(): Promise<void> {
    this.httpServerPort = await getPort({ host: '127.0.0.1', port: 55906 });
    this.httpServer = new HttpServer((message) => this.instanceManager.processMessage(message));
    await this.httpServer.listen(this.httpServerPort);
    this.logger.info('http server ready', { port: this.httpServerPort });
  }

  private async setupPuppeteerBeforeAppReady(): Promise<void> {
    if (this.eApp.isReady()) {
      throw new Error('Must be called at startup before the electron app is ready.');
    }
    const actualPort = await getPort({ host: '127.0.0.1', port: 9219 });
    this.eApp.commandLine.appendSwitch('remote-debugging-port', `${actualPort}`);
    this.eApp.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
    if (ENVIRONMENT.IS_LOCAL || ENVIRONMENT.IS_DEV) {
      // Alow call to localhost
      this.eApp.commandLine.appendSwitch(
        'disable-features',
        'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults'
      );
    }
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
    if (this.tunnelManager) {
      await this.tunnelManager.stop();
      this.tunnelManager = null;
    }
    await this.clientKvStorage.delItem('tunnelState');
    this.options = {};
    await this.clientKvStorage.delItem('applicationOptions');
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

  getDownloadManager(): DownloadManager {
    return this.downloadManager;
  }
}

export { Application };
