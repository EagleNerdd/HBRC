export type BrowserInstanceInstruction = {
  command: 'browserEval' | 'page' | 'eval';
  pageCommand?: string;
  evalCommand?: string;
  args: any[];
};

export type BrowserInstanceStatus = 'Running' | 'Stopped' | 'Starting' | 'Stopping';

export type BrowserInstanceType = 'electron' | 'puppeteer' | 'single-puppeteer';

export const BrowserInstanceNames: Record<BrowserInstanceType, string> = {
  electron: 'Integrated',
  puppeteer: 'Isolate',
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

export type JobInstruction = {
  command: 'browserEval' | 'page';
  pageCommand?: string;
  args: any[];
};

export type JobAction = 'restart' | 'stop' | 'ignore';

/**
 * Configuration for a periodic background Job running on the Client
 */
export type IntervalJobConfig = {
  /** Unique identifier for this Job (e.g., 'health-check', 'keep-alive') */
  id: string;
  /** Execution interval of the Job in seconds */
  intervalSeconds: number;
  /** List of instructions to execute sequentially in each interval */
  instructions: JobInstruction[];
  /** Maximum allowed execution time in seconds before marking it as a timeout (default: 10) */
  timeoutSeconds?: number;
  /** Number of consecutive failures or timeouts before triggering onFail action (default: 3) */
  failureThreshold?: number;
  /** Action to perform when failures exceed failureThreshold (default: 'ignore') */
  onFail?: JobAction;
};

/**
 * Internal runtime state of an active Job
 */
export type JobState = IntervalJobConfig & {
  /** Current number of consecutive failures */
  failures: number;
  /** Flag indicating whether the Job is currently active */
  isRunning: boolean;
  /** Reference to the NodeJS Timeout to clear the interval when necessary */
  timer: NodeJS.Timeout | null;
};
