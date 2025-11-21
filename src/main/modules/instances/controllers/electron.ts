import { Browser, Page } from 'puppeteer-core';
import { BrowserWindow } from 'electron';
import { BrowserInstance } from '@shared/types';
import { ClientEvents } from '@main/modules/events';
import { TransporterMessaging } from '@main/modules/transporters';
import { BasePuppeteerInstanceController } from './puppeteer';
import { getLatestUserAgent, isDebugging } from '@main/utils';
import { randomString } from '@shared/utils/random';

export class ElectronInstanceController extends BasePuppeteerInstanceController {
  constructor(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    page: Page,
    private window: BrowserWindow,
  ) {
    super(instance, transporterMessaging, clientEvents, page);
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
    },
  ): Promise<ElectronInstanceController> {
    const { show, hideOnClose, identifier = instance.sessionId || randomString(30) } = options || {};

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
    return new ElectronInstanceController(instance, transporterMessaging, clientEvents, page, window);
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

  async destroy(): Promise<void> {
    await this.closeWindow();
    await super.destroy();
  }
}
