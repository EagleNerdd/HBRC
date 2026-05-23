import { BaseBrowserInstanceController } from './base';
import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer-core';
import { executablePath } from 'puppeteer';
import { BrowserInstance, BrowserInstanceInstruction, IntervalJobConfig, JobState } from '@shared/types';
import { createLogger, Logger } from '@main/logging';
import { TransporterMessaging } from '@main/modules/transporters';
import { ClientEvents } from '@main/modules/events';
import { getDataPath, getLatestUserAgent } from '@main/utils';
import { randomString } from '@shared/utils/random';

export abstract class BasePuppeteerInstanceController extends BaseBrowserInstanceController {
  public static readonly PageLoadTimeout = 300_000;

  private logger: Logger;
  protected browser?: Browser | BrowserContext;
  protected activeJobs: Map<string, JobState> = new Map();
  protected supportedEvalCommands: Set<string> = new Set(['addJob']);

  protected constructor(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    events: ClientEvents,
    protected page: Page,
    browser?: Browser | BrowserContext
  ) {
    super(instance, transporterMessaging, events);
    this.logger = createLogger('puppeteerInstanceController');
    this.browser = browser;
  }

  async restart() {
    await this.clearJobs();
    await this.page.reload();
    await this.init();
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
    const { command, pageCommand, evalCommand, args } = instruction;
    if (command == 'page' && pageCommand) {
      const func = this.page[pageCommand];
      if (!func) {
        throw new Error(`page command ${pageCommand} not found`);
      }
      return await func.bind(this.page)(...args);
    } else if (command === 'browserEval') {
      return await this.browserEval.apply(this, args);
    } else if (command === 'eval' && evalCommand) {
      if (!this.supportedEvalCommands.has(evalCommand)) {
        throw new Error(`eval command ${evalCommand} is not supported`);
      }
      const func = this[evalCommand];
      if (!func || typeof func !== 'function') {
        throw new Error(`eval command ${evalCommand} not found`);
      }
      return await func.apply(this, args);
    } else {
      throw new Error(`command ${command} invalid`);
    }
  }

  browserEval(code: string): Promise<any> {
    return this.page.evaluate(code);
  }

  async addJob(config: IntervalJobConfig) {
    const jobState: JobState = {
      ...config,
      timeoutSeconds: config.timeoutSeconds || 10,
      failureThreshold: config.failureThreshold || 3,
      onFail: config.onFail || 'ignore',
      failures: 0,
      isRunning: true,
      timer: null,
    };

    this.activeJobs.set(config.id, jobState);

    const runJob = async () => {
      if (!jobState.isRunning || !this.activeJobs.has(config.id)) return;

      try {
        const startTime = Date.now();
        let result: any;
        for (const instr of jobState.instructions) {
          result = await this.executeInstruction(instr as BrowserInstanceInstruction);
        }

        console.log('Result: ', result);

        const executionTime = Date.now() - startTime;
        const isTimeout = executionTime > jobState.timeoutSeconds! * 1000;

        if (result && !isTimeout) {
          jobState.failures = 0;
        } else {
          jobState.failures++;
        }
      } catch (error) {
        this.logger.error(`Job [${config.id}] failed with error:`, error);
        jobState.failures++;
      }

      if (jobState.failures >= jobState.failureThreshold!) {
        this.logger.warn(`Job [${config.id}] reached failure threshold! Action: ${jobState.onFail}`);
        if (jobState.onFail === 'restart') {
          return this.restart();
        } else if (jobState.onFail === 'stop') {
          return this.closeWindow();
        }
      }

      if (jobState.isRunning) {
        jobState.timer = setTimeout(runJob, jobState.intervalSeconds * 1000);
      }
    };

    jobState.timer = setTimeout(runJob, jobState.intervalSeconds * 1000);
  }

  async clearJobs() {
    this.activeJobs.forEach((job) => {
      job.isRunning = false;
      if (job.timer) clearTimeout(job.timer);
    });
    this.activeJobs.clear();
  }

  async closeWindow() {
    await this.clearJobs();
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

  constructor(
    instance: BrowserInstance,
    transporterMessaging: TransporterMessaging,
    events: ClientEvents,
    page: Page,
    browser?: Browser,
    private options?: {
      identifier?: string;
      userAgent?: string;
      onClose?: () => void;
    }
  ) {
    super(instance, transporterMessaging, events, page, browser);
    this._onClose = options?.onClose;
  }

  static async launchBrowser(
    headless: boolean,
    userAgent?: string | undefined,
    dataDir?: string
  ): Promise<{ browser: Browser; page: Page }> {
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
    url: string
  ): Promise<{ browser: Browser; page: Page }> {
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
      onClose?: () => void;
    }
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
    const controller = new PuppeteerInstanceController(
      instance,
      transporterMessaging,
      clientEvents,
      page,
      browser,
      opts
    );
    await controller.postInstanceUpdated({ headless });
    return controller;
  }

  async switchToHeadless(headless: boolean) {
    await this.postInstanceUpdated({ status: 'Starting', headless });
    const { browser, page } = await PuppeteerInstanceController.createBrowser(
      headless,
      this.options.identifier,
      this.options.userAgent,
      this.instance.url
    );
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
