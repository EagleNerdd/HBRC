import { TransportersOptions } from '@main/modules/transporters';
import { TransporterStatus } from '@shared/types/transporter';
import BrowserInstanceManager from '@main/modules/instances/manager';

export type HBRCAppOptions = {
  agentId?: string;
  serverName?: string;
  transporters?: TransportersOptions;
};

export type HBRCAppInfo = {
  options: HBRCAppOptions;
  transporterStatus: TransporterStatus;
  version: string;
  userPath: string;
  isDebug: boolean;
};

export interface HBRCApplication {
  init(): Promise<void>;
  getAppInfo(): Promise<HBRCAppInfo>;
  setOptions(options: HBRCAppOptions): Promise<void>;
  getInstanceManager(): BrowserInstanceManager;
  disconnectServer(): Promise<void>;
  enableDebugMode(): void;
}
