export type BrowserInstanceInstruction = {
  command: 'browserEval' | 'page';
  pageCommand?: string;
  args: any[];
};

export type BrowserInstanceStatus = 'Running' | 'Stopped' | 'Starting' | 'Stopping';

export type BrowserInstanceMessage = {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

export type BrowserInstance = {
  sessionId: string;
  name: string;
  url: string;
  status?: BrowserInstanceStatus;
  initInstructions?: BrowserInstanceInstruction[];
  userAgent?: string;
  [key: string]: any;
};
