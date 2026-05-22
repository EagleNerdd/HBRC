import { TransportersOptions } from '@main/modules/transporters';
import { TransporterStatus } from '@shared/types/transporter';
import BrowserInstanceManager from '@main/modules/instances/manager';
import { DownloadManager } from '@main/modules/downloader';
import { FrpTunnelOptions } from '@main/modules/tunnel';
import { TunnelState } from '@shared/types';

export type HBRCAppOptions = {
  agentId?: string;
  serverName?: string;
  transporters?: TransportersOptions;
  tunnels?: {
    frp?: FrpTunnelOptions;
    cloudflare?: any;
  };
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
  getDownloadManager(): DownloadManager;
  disconnectServer(): Promise<void>;
  setDebugMode(isDebug: boolean): void;
  isTunnelActive(): boolean;
  getTunnelState(): Promise<TunnelState>;
  activateTunnel(selectedProviders: string[]): Promise<void>;
  deactivateTunnel(): Promise<void>;
}
