import { PreloadEventKey, PreloadEventListener } from '@shared/event/preload';
import { MenuItemId } from '@shared/constants';
import { TransporterStatus } from './transporter';
import { MainEventKey } from '@shared/event/main';

export type ApplicationAPI = {
  setApplicationOptions: (options: any) => Promise<any>;
  getApplicationInfo: () => Promise<any>;
  onMenuItemClick: (menuItemId: MenuItemId, callback: PreloadEventListener<any>) => number;
  onMenuItemProcessed: (menuItemId: MenuItemId, callback: PreloadEventListener<any>) => number;
  subscribeEvent: (eventKey: PreloadEventKey, callback: PreloadEventListener<any>) => number;
  unsubscribeEvent: (subscriptionId: number) => void;
  subscribeEvents: (eventKeys: PreloadEventKey[], callback: PreloadEventListener<any>) => number[];
  unsubscribeEvents: (subscriptionIds: number[]) => void;
  emitMainEvent: (eventKey: MainEventKey, data?: any) => void;
};

export type BrowserInstanceManagerAPI = {
  getInstances: () => Promise<any>;
  addInstance: (name: string, url: string) => Promise<any>;
  deleteInstance: (sessionId: string) => Promise<any>;
  showInstanceWindow: (sessionId: string) => Promise<any>;
  callInstanceFunction: (sessionId: string, method: string, ...args: any[]) => Promise<any>;
  startInstance: (sessionId: string) => Promise<any>;
  stopInstance: (sessionId: string) => Promise<any>;
};

export type ApplicationOptions = {
  serverName?: string;
};

export type ApplicationInfo = {
  options?: ApplicationOptions;
  transporterStatus: TransporterStatus;
  version: string;
  userPath: string;
  isDebug: boolean;
};
