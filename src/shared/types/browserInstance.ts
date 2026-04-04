export type BrowserInstanceInstruction = {
  command: 'browserEval' | 'page' | 'healthCheck';
  pageCommand?: string;
  args: any[];
};

export type BrowserInstanceStatus = 'Running' | 'Stopped' | 'Starting' | 'Stopping';

export type BrowserInstanceType = 'electron' | 'puppeteer' | 'single-puppeteer';

export const BrowserInstanceNames: Record<BrowserInstanceType, string> = {
  'electron': 'Integrated',
  'puppeteer': 'Isolate',
  'single-puppeteer': 'Lightweight',
};

export type BrowserInstanceMessage = {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

export type BrowserInstance = {
  sessionId: string;
  name: string;
  type: BrowserInstanceType;
  url: string;
  status?: BrowserInstanceStatus;
  initInstructions?: BrowserInstanceInstruction[];
  userAgent?: string;
  attributes?: Record<string, string>;
  headless?: boolean;
  [key: string]: any;
};

export type HealthCheckConfig = {
  failureThreshold: number;
  intervalSeconds: number;
  timeout: number;
  instruction: BrowserInstanceInstruction;
}

export type HealthCheckState = HealthCheckConfig & {
  isEnabled: boolean;
  intervalTimer?: NodeJS.Timeout;
  lastCheck: number;
  lastCheckResult: boolean;
  failures: number;
}
