import { Browser, Page } from 'puppeteer-core';
import { BrowserWindow } from 'electron';
import { BrowserInstance } from '@shared/types';
import { ClientEvents } from '@main/modules/events';
import { TransporterMessaging } from '@main/modules/transporters';
import { BasePuppeteerInstanceController } from './puppeteer';
import { getLatestUserAgent, isDebugging } from '@main/utils';
import { randomString } from '@shared/utils/random';

export class ElectronInstanceController extends BasePuppeteerInstanceController {
  private onCloseCallback?: () => void;
  private renderProcessGoneListener?: () => void;

  constructor(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    page: Page,
    private window: BrowserWindow,
    onClose?: () => void
  ) {
    super(instance, transporterMessaging, clientEvents, page);
    this.onCloseCallback = () => {
      onClose?.();
      this.tryDestroyWindow();
    };
    this.renderProcessGoneListener = () => {
      onClose?.();
      this.tryDestroyWindow();
    };
    window.on('closed', this.onCloseCallback);
    window.webContents.on('render-process-gone', this.renderProcessGoneListener);
  }

  static async createWithWindow(
    browser: Browser,
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    options?: {
      show?: boolean;
      hideOnClose?: boolean;
      identifier?: string;
      onClose?: () => void;
    }
  ): Promise<ElectronInstanceController> {
    const { show, hideOnClose, identifier = instance.sessionId || randomString(30), onClose } = options || {};

    const window = new BrowserWindow({
      show: !!show,
      autoHideMenuBar: true,
      webPreferences: {
        partition: `persist:${identifier}`,
        allowRunningInsecureContent: true,
        webSecurity: false,
      },
    });

    if (hideOnClose) {
      window.on('close', (e) => {
        e.preventDefault();
        window.hide();
      });
    }

    const userAgent = instance.userAgent || getLatestUserAgent('windows', 'chrome');
    await window.loadURL(instance.url, { userAgent });
    await window.webContents.executeJavaScript(`window.hbrcWindowId = '${identifier}'`);

    if (isDebugging()) {
      window.webContents.openDevTools({ mode: 'undocked' });
    }

    const page = await ElectronInstanceController.getPageFromBrowser(browser, identifier);
    if (!page) {
      window.close();
      throw new Error('Failed to get page from browser');
    }

    instance.sessionId = identifier;
    return new ElectronInstanceController(instance, transporterMessaging, clientEvents, page, window, onClose);
  }

  private static async getPageFromBrowser(browser: Browser, identifier: string): Promise<Page | null> {
    const pages = await browser.pages();
    for (const page of pages) {
      try {
        const windowId = await page.evaluate('window.hbrcWindowId');
        if (windowId === identifier) return page;
      } catch (e) {
        // Page might be closed or not accessible
      }
    }
    return null;
  }

  async showWindow() {
    if (this.window) {
      if (isDebugging()) {
        this.window.webContents.openDevTools({ mode: 'right' });
      }
      this.window.show();
      await this.postInstanceUpdated({ status: 'Running' });
    }
  }

  async hideWindow() {
    if (this.window) {
      this.window.hide();
    }
  }

  getWindow() {
    return this.window;
  }

  private tryDestroyWindow() {
    try {
      if (!this.window.isDestroyed()) {
        if (this.onCloseCallback) {
          this.window.removeListener('closed', this.onCloseCallback);
        }
        if (this.renderProcessGoneListener) {
          this.window.webContents.removeListener('render-process-gone', this.renderProcessGoneListener);
        }
        this.window.destroy();
      }
    } catch (e) {
      // ignore
    }
  }

  async destroy(): Promise<boolean> {
    await super.destroy();
    this.tryDestroyWindow();
    this.onCloseCallback = undefined;
    this.renderProcessGoneListener = undefined;
    return true;
  }
}
