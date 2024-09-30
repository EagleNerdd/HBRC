import path from 'path';
import { KVStorage } from '@shared/storages/kvStorage';
import { ClientKvStorage, ElectronKvStorage } from './modules/storages/kvStorage';
import { ClientEvents } from './modules/events';
import BrowserInstanceManager from './modules/instances/manager';
import { app, BrowserWindow, App as ElectronApp } from 'electron';
import { PuppeteerElectron } from './pie';

import { makeAppSetup } from './factories';
import { MainWindow } from './windows';
import { registerIPCs } from './ipcs';
import { Queue } from '@shared/queue/base';
import {
  ON_APPLICATION_READY,
  ON_INSTANCE_UPDATED,
  ON_SERVER_DISCONNECTED,
  ON_TRANSPORTER_STATUS_CHANGED,
} from '@shared/constants/ipcs';
import { FileQueue } from '@main/modules/queue';
import {
  Transporter,
  DummyTransporter,
  MqttTransporter,
  MqttTransporterOptions,
  HttpTransporterOptions,
  HttpTransporter,
} from './modules/transporters';
import { OutgoingTransportMessage, IncommingTransportMessage } from '@shared/types/message';
import { getComputerName } from '@shared/utils/node';
import { Logger, createLogger } from './logging';
import { TransporterStatus } from '@shared/types/transporter';

export type ApplicationOptions = {
  serverName?: string;
  transporter?: {
    http?: HttpTransporterOptions;
    mqtt?: MqttTransporterOptions;
  };
};

export class Application {
  private events: ClientEvents;
  private kvStorage: KVStorage;
  private clientKvStorage: ClientKvStorage;
  private instanceManager: BrowserInstanceManager;
  private puppeteerElectron: PuppeteerElectron;
  private _isReady = false;
  private ttcMessagesQueue: Queue; // TransporterToController: this queue pass message from transporter to controller
  private cttMessagesQueue: Queue; // ControllerToTransporter: this queue pass message from controller to transporter
  private transporter: Transporter;
  private agentName: string;
  private logger: Logger;
  private mainWindow?: BrowserWindow;
  private transporterStatus: TransporterStatus = 'disconnected';
  constructor(private readonly eApp: ElectronApp, private options: ApplicationOptions) {
    this.logger = createLogger('app', 'debug');
    this.kvStorage = new ElectronKvStorage();
    this.clientKvStorage = new ClientKvStorage(this.kvStorage);
    this.events = new ClientEvents();
    this.puppeteerElectron = new PuppeteerElectron(this.eApp);
    this.ttcMessagesQueue = new FileQueue(path.join(eApp.getAppPath(), 'out', 'data', 'message_queues', 'ttc'), {
      messageMaxRequeueNumber: 10,
    });
    this.cttMessagesQueue = new FileQueue(path.join(eApp.getAppPath(), 'out', 'data', 'message_queues', 'ctt'));
    this.instanceManager = new BrowserInstanceManager(
      this.puppeteerElectron,
      {
        ttc: this.ttcMessagesQueue,
        ctt: this.cttMessagesQueue,
      },
      this.events
    );
    this.transporter = new DummyTransporter();
    this.agentName = getComputerName();
  }

  async getAppInfo() {
    return {
      options: this.options,
      transporterStatus: this.transporterStatus,
    };
  }

  async setOptions(options: ApplicationOptions, save = true) {
    this.options = { ...this.options, ...options };
    this.logger.debug('setOptions', { options });
    await this.initTranporter(options.transporter);
    if (save) {
      await this.clientKvStorage.setItem('applicationOptions', this.options);
    }
  }

  async initTranporter(transporter: ApplicationOptions['transporter']) {
    if (!transporter) {
      return;
    }
    this.events.onTransporterStatusChanged.emit('connecting');
    if (transporter.mqtt) {
      this.transporter = new MqttTransporter(transporter.mqtt);
    } else if (transporter.http) {
      this.transporter = new HttpTransporter(transporter.http);
    }
    if (this.transporter) {
      this.transporter.onReceive(async (data: IncommingTransportMessage) => {
        if (data.controlInstance || data.manageInstance) {
          await this.ttcMessagesQueue.push(data);
        }
      });
      this.transporter.onConnected(async () => {
        await this.pushMessageToTransporter('info', { name: this.agentName });
        await this.instanceManager.pushListInstanceMessage();
        this.events.onTransporterStatusChanged.emit('connected');
      });
      this.transporter.connect();
    }
  }

  async pushMessageToTransporter(action: OutgoingTransportMessage['agent']['action'], payload: any) {
    const msg: OutgoingTransportMessage = {
      agent: {
        action: action,
        payload: payload,
      },
    };
    this.cttMessagesQueue.push(msg);
  }

  private async initOptions() {
    const ops = await this.clientKvStorage.getItem('applicationOptions');
    if (ops) {
      await this.setOptions(ops, false);
    }
  }

  private async initMessageQueues() {
    this.cttMessagesQueue.onMessage(async (data) => {
      if (this.transporter) {
        await this.transporter.send(data);
      }
    });
    await this.cttMessagesQueue.start();
  }

  async init() {
    await this.puppeteerElectron.beforeAppReady();
    await this.initElectronApp();
    await this.puppeteerElectron.afterAppReady();
    await this.instanceManager.init();
    await this.initMessageQueues();
    await this.initOptions();
    this._isReady = true;
    this.events.onClientReady.emit();
    // setInterval(() => {
    //   this.cttMessagesQueue.push({ message: new Date().toISOString() });
    // }, 3000);
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
      this.transporterStatus = status;
      this.sendMainWindowEvent(ON_TRANSPORTER_STATUS_CHANGED, status);
    });
    this.events.onInstanceUpdated.listen((data) => {
      this.sendMainWindowEvent(ON_INSTANCE_UPDATED, data);
    });
  }

  async disconnectServer() {
    this.options = {};
    this.clientKvStorage.delItem('applicationOptions');
    this.transporter.disconnect();
    this.events.onTransporterStatusChanged.emit('disconnected');
    this.sendMainWindowEvent(ON_SERVER_DISCONNECTED);
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
}

export default Application;
