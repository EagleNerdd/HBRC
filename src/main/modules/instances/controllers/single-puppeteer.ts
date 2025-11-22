import { Browser, BrowserContext, Cookie, HTTPRequest, Page } from 'puppeteer-core';
import { BrowserInstance } from '@shared/types';
import { TransporterMessaging } from '@main/modules/transporters';
import { ClientEvents } from '@main/modules/events';
import { getDataPath, getLatestUserAgent } from '@main/utils';
import { randomString } from '@shared/utils/random';
import { BasePuppeteerInstanceController, PuppeteerInstanceController } from './puppeteer';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

export class SinglePuppeteerInstanceController extends BasePuppeteerInstanceController {
  static singletonBrowsers: Map<string, Browser> = new Map();
  protected _browser?: Browser;
  protected dataFilePath?: string;

  constructor(instance: BrowserInstance,
              transporterMessaging: TransporterMessaging,
              events: ClientEvents,
              page: Page,
              browser?: Browser,
              context?: BrowserContext,
              private options?: {
                identifier?: string,
                userAgent?: string,
              },
  ) {
    super(instance, transporterMessaging, events, page, context);
    this._browser = browser;
    if (options?.identifier) {
      this.dataFilePath = getDataPath('single_puppeteer_data', `${options.identifier}.json`);
    }
  }

  static async getBrowser(headless: boolean): Promise<Browser> {
    const singletonKey = headless ? 'headless' : 'default';
    let browser = this.singletonBrowsers.get(singletonKey);
    if (!browser) {
      const { browser } = await PuppeteerInstanceController.launchBrowser(headless);
      this.singletonBrowsers.set(singletonKey, browser);
      return browser;
    }
    return browser;
  }

  static async createBrowserContext(headless: boolean, identifier: string, userAgent: string | undefined): Promise<{
    browser: Browser,
    context: BrowserContext,
    page: Page
  }> {
    const browser = await this.getBrowser(headless);
    const context = await browser.createBrowserContext();

    const pages = await context.pages();
    const page = pages[0] || (await context.newPage());

    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    await page.evaluateOnNewDocument((id: string) => {
      (window as any).hbrcWindowId = id;
    }, identifier);

    return { browser, context, page };
  }

  static async createWithBrowser(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    options?: {
      show?: boolean;
      identifier?: string;
    },
  ): Promise<SinglePuppeteerInstanceController> {
    const { show, identifier = instance.sessionId || randomString(30) } = options || {};
    const headless = !show;
    const userAgent = instance.userAgent || getLatestUserAgent('windows', 'chrome');

    const opts = { identifier, userAgent };
    const { browser, context, page } = await this.createBrowserContext(headless, opts.identifier, opts.userAgent);

    instance.sessionId = identifier;
    const controller = new SinglePuppeteerInstanceController(instance, transporterMessaging, clientEvents, page, browser, context, opts);
    await controller.postInstanceUpdated({ headless });
    return controller;
  }

  async switchToHeadless(headless: boolean) {
    await this.postInstanceUpdated({ status: 'Starting', headless });
    const { browser, page } = await SinglePuppeteerInstanceController.createBrowserContext(headless, this.options.identifier, this.options.userAgent);
    this.browser = browser;
    this.page = page;
    await this.init();
    await this.postInstanceUpdated({ status: 'Running' });
  }

  async showWindow() {
    await this.closeWindow();
    await this.switchToHeadless(false);
  }

  async hideWindow() {
    await this.closeWindow();
    await this.switchToHeadless(true);
  }

  async init(): Promise<void> {
    await this.page.setRequestInterception(true);
    this.page.on('request', this.onRequest.bind(this));

    await this.restoreSession();
    await this.page.goto(this.instance.url, { waitUntil: 'networkidle2' });

    await super.init();
  }

  protected async onRequest(request: HTTPRequest) {
    if (request.isNavigationRequest()) {
      const url = new URL(request.url());
      const action = url.searchParams.get('hbrc');
      if (action) {
        return await request.respond({ status: 200, contentType: 'text/plain', body: 'HBRC Loading ....' });
      }
    }
    await request.continue();
  }

  async closeWindow(): Promise<void> {
    await this.saveSession();
    await super.closeWindow();
  }

  async restoreSession() {
    if (!this.dataFilePath) return;
    await this.page.goto(this.instance.url + '?hbrc=restore-session');
    let raw: Buffer | null = null;
    try {
      raw = await readFile(this.dataFilePath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
      return;
    }
    if (!raw) return;
    const { cookies, localStorage } = JSON.parse(raw.toString()) as { cookies: Cookie[], localStorage: Record<string, string> };
    await this.page.setCookie(...cookies);
    await this.page.evaluate((items) => Object.keys(items).forEach(key => window.localStorage.setItem(key, items[key])), localStorage);
  }

  async saveSession() {
    if (!this.dataFilePath) return;
    await this.page.goto(this.instance.url + '?hbrc=save-session');
    const cookies = await this.page.cookies();
    const localStorage = JSON.parse(await this.page.evaluate(() => JSON.stringify(window.localStorage))) as Record<string, string>;
    await mkdir(dirname(this.dataFilePath), { recursive: true });
    await writeFile(this.dataFilePath, JSON.stringify({ cookies, localStorage }));
  }
}
