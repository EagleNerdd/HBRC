import { BaseBrowserInstanceController } from './base';
import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer-core';
import { executablePath } from 'puppeteer';
import { BrowserInstance, BrowserInstanceInstruction, HealthCheckConfig, HealthCheckState } from '@shared/types';
import { createLogger, Logger } from '@main/logging';
import { TransporterMessaging } from '@main/modules/transporters';
import { ClientEvents } from '@main/modules/events';
import { getDataPath, getLatestUserAgent } from '@main/utils';
import { randomString } from '@shared/utils/random';

export abstract class BasePuppeteerInstanceController extends BaseBrowserInstanceController {
  public static readonly PageLoadTimeout = 300_000;

  private logger: Logger;
  protected browser?: Browser | BrowserContext;
  protected _healthCheckState?: HealthCheckState | null = null;

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

  async _reset(): Promise<void> {
    if (this._healthCheckState && this._healthCheckState.intervalTimer) {
      this._healthCheckState.isEnabled = false;
      clearInterval(this._healthCheckState.intervalTimer);
    }
    this._healthCheckState = null;
  }

  async restart() {
    await this._reset();
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
    } else if (['browserEval', 'healthCheck'].includes(command)) {
      return await this[command].bind(this)(...args);
    } else {
      throw new Error(`command ${command} invalid`);
    }
  }

  browserEval(code: string): Promise<any> {
    return this.page.evaluate(code);
  }

  async healthCheck(config: Partial<HealthCheckConfig> & Pick<HealthCheckConfig, 'instruction'>): Promise<void> {
    const defaults: Omit<HealthCheckState, 'instruction'> = {
      isEnabled: false,
      failureThreshold: 3,
      intervalSeconds: 15,
      timeout: 10,
      lastCheck: 0,
      lastCheckResult: true,
      failures: 0,
    };
    const s = Object.assign({}, defaults, config);
    this._healthCheckState = s;
    if (!s.instruction) {
      return;
    }
    if (s.intervalSeconds > 0) {
      s.isEnabled = true;
      const check = async (): Promise<void> => {
        if (!s.isEnabled) {
          return clearInterval(s.intervalTimer);
        }
        const startTime = Date.now();
        s.lastCheck = startTime;
        const result = await this.executeInstruction(s.instruction);
        if (Date.now() - startTime > s.timeout || s.lastCheck !== startTime) {
          return;
        }
        s.lastCheckResult = !!result;
        if (s.lastCheckResult) {
          s.failures = 0;
        } else {
          s.failures++;
        }
        if (s.failures >= s.failureThreshold) {
          return this.restart();
        }
      };
      s.intervalTimer = setInterval(check, s.intervalSeconds * 1000);
    }
  }

  async closeWindow() {
    if (this.browser) {
      await this.postInstanceUpdated({ status: 'Stopping' });
      this.logger.debug('Closing browser', { sessionId: this.instance.sessionId });
      try {
        await this.browser.close();
      } catch (e) {
        this.logger.error('Error closing browser', { error: e, sessionId: this.instance.sessionId });
      }
    }
  }

  async destroy(): Promise<boolean> {
    await this.closeWindow();
    return false; // Keep controller after destroy
  }
}

export class PuppeteerInstanceController extends BasePuppeteerInstanceController {
  private readonly _onClose: () => void;

  constructor(instance: BrowserInstance,
              transporterMessaging: TransporterMessaging,
              events: ClientEvents,
              page: Page,
              browser?: Browser,
              private options?: {
                identifier?: string,
                userAgent?: string,
                onClose?: () => void,
              },
  ) {
    super(instance, transporterMessaging, events, page, browser);
    this._onClose = options?.onClose;
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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: BasePuppeteerInstanceController.PageLoadTimeout });

    return { browser, page };
  }

  static async createWithBrowser(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    clientEvents: ClientEvents,
    options?: {
      show?: boolean;
      identifier?: string;
      onClose?: () => void,
    },
  ): Promise<PuppeteerInstanceController> {
    const { show, identifier = instance.sessionId || randomString(30), onClose } = options || {};
    const headless = !show;
    const userAgent = instance.userAgent || getLatestUserAgent('windows', 'chrome');

    const opts = { identifier, userAgent, onClose };
    const { browser, page } = await this.createBrowser(headless, opts.identifier, opts.userAgent, instance.url);

    if (onClose) {
      browser.on('disconnected', onClose);
      page.on('close', onClose);
    }

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
    if (this._onClose) {
      browser.on('disconnected', this._onClose);
      page.on('close', this._onClose);
    }
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
