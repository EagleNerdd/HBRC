import { BaseBrowserInstanceController } from './base';
import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer-core';
import { executablePath } from 'puppeteer';
import { BrowserInstance, BrowserInstanceInstruction } from '@shared/types';
import { createLogger, Logger } from '@main/logging';
import { TransporterMessaging } from '@main/modules/transporters';
import { ClientEvents } from '@main/modules/events';
import { getDataPath, getLatestUserAgent } from '@main/utils';
import { randomString } from '@shared/utils/random';

export abstract class BasePuppeteerInstanceController extends BaseBrowserInstanceController {
  private logger: Logger;
  protected browser?: Browser | BrowserContext;

  protected constructor(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    events: ClientEvents,
    protected page: Page,
    browser?: Browser | BrowserContext,
  ) {
    super(instance, transporterMessaging, events);
    this.logger = createLogger('puppeteerInstanceController');
    this.browser = browser;
  }

  async restart() {
    await this.page.reload();
    await this.executeInitInstructions();
  }

  private async executeInitInstructions() {
    if (this.instance.initInstructions) {
      try {
        await this.executeInstructions(this.instance.initInstructions);
      } catch (e) {
        this.logger.error('Error executing init instructions', {
          error: e,
          instructions: this.instance.initInstructions,
          sessionId: this.instance.sessionId,
        });
      }
    }
  }

  async init(): Promise<void> {
    await this.page.exposeFunction('bicPostMessage', this.postMessage.bind(this));
    await this.page.exposeFunction('bicPostInstanceMessage', this.postInstanceMessage.bind(this));
    await this.executeInitInstructions();
  }

  async executeInstructions(instructions: BrowserInstanceInstruction[]): Promise<any[]> {
    const results = [];
    for (const instruction of instructions) {
      const r = await this.executeInstruction(instruction);
      results.push(r);
    }
    return results;
  }

  async executeInstruction(instruction: BrowserInstanceInstruction): Promise<any> {
    const { command, pageCommand, args } = instruction;
    if (command == 'page' && pageCommand) {
      const func = this.page[pageCommand];
      if (!func) {
        throw new Error(`page command ${pageCommand} not found`);
      }
      return await func.bind(this.page)(...args);
    } else if (command == 'browserEval') {
      return await this[command].bind(this)(...args);
    } else {
      throw new Error(`command ${command} invalid`);
    }
  }

  browserEval(code: string): Promise<any> {
    return this.page.evaluate(code);
  }

  async closeWindow() {
    if (this.browser) {
      await this.postInstanceUpdated({ status: 'Stopping' });
      this.logger.debug('Closing browser', { sessionId: this.instance.sessionId });
      await this.browser.close();
    }
  }

  async destroy(): Promise<void> {
    await this.closeWindow();
  }
}

export class PuppeteerInstanceController extends BasePuppeteerInstanceController {
  constructor(instance: BrowserInstance,
              transporterMessaging: TransporterMessaging,
              events: ClientEvents,
              page: Page,
              browser?: Browser,
              private options?: {
                identifier?: string,
                userAgent?: string,
              },
  ) {
    super(instance, transporterMessaging, events, page, browser);
  }

  static async launchBrowser(
    headless: boolean,
    userAgent?: string | undefined,
    dataDir?: string,
  ): Promise<{ browser: Browser, page: Page }> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ];
    if (dataDir) {
      args.push(`--user-data-dir=${dataDir}`);
    }

    const browser = await puppeteer.launch({
      headless,
      executablePath: process.env.CHROME_PATH ?? executablePath('chrome'),
      args,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    return { browser, page };
  }

  static async createBrowser(
    headless: boolean,
    identifier: string,
    userAgent: string | undefined,
    url: string,
  ): Promise<{ browser: Browser, page: Page }> {
    const dataDir = getDataPath('puppeteer_data', identifier);

    const { browser, page } = await this.launchBrowser(headless, userAgent, dataDir);

    await page.evaluateOnNewDocument((id: string) => {
      (window as any).hbrcWindowId = id;
    }, identifier);

    await page.goto(url, { waitUntil: 'networkidle2' });

    return { browser, page };
  }

  static async createWithBrowser(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    options?: {
      show?: boolean;
      identifier?: string;
    },
  ): Promise<PuppeteerInstanceController> {
    const { show, identifier = instance.sessionId || randomString(30) } = options || {};
    const headless = !show;
    const userAgent = instance.userAgent || getLatestUserAgent('windows', 'chrome');

    const opts = { identifier, userAgent };
    const { browser, page } = await this.createBrowser(headless, opts.identifier, opts.userAgent, instance.url);

    instance.sessionId = identifier;
    const controller = new PuppeteerInstanceController(instance, transporterMessaging, clientEvents, page, browser, opts);
    await controller.postInstanceUpdated({ headless });
    return controller;
  }

  async switchToHeadless(headless: boolean) {
    await this.postInstanceUpdated({ status: 'Starting', headless });
    const { browser, page } = await PuppeteerInstanceController.createBrowser(headless, this.options.identifier, this.options.userAgent, this.instance.url);
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
}
