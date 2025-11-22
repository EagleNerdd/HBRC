import { BrowserInstance } from '@shared/types';
import { ClientEvents } from '@main/modules/events';
import { TransporterMessaging } from '@main/modules/transporters';
import { Browser } from 'puppeteer-core';
import { PuppeteerInstanceController } from './puppeteer';
import { createLogger } from '@main/logging';
import { ElectronInstanceController } from './electron';
import { BrowserInstanceController } from './base';
import { SinglePuppeteerInstanceController } from './single-puppeteer';

const logger = createLogger('instance-controller-factory');

export const createInstanceController = async (
  browser: Browser,
  bi: BrowserInstance,
  transporterMessaging: TransporterMessaging,
  clientEvents: ClientEvents,
  options?: {
    show?: boolean;
    hideOnClose?: boolean;
    identifier?: string;
  },
): Promise<BrowserInstanceController> => {
  logger.info(`Creating instance controller for type: ${bi.type} (show=${options.show}, identifier=${options.identifier})`);
  switch (bi.type) {
    case 'electron':
      return await ElectronInstanceController.createWithWindow(
        browser,
        bi,
        transporterMessaging,
        clientEvents,
        options,
      );
    case 'puppeteer':
      return await PuppeteerInstanceController.createWithBrowser(bi, transporterMessaging, clientEvents, options);
    case 'single-puppeteer':
      return await SinglePuppeteerInstanceController.createWithBrowser(bi, transporterMessaging, clientEvents, options);
    default:
      throw new Error(`Unsupported instance type: ${bi.type}`);
  }
};
