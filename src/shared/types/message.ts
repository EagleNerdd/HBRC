import { BrowserInstanceInstruction } from './browserInstance';

export type IncommingTransportMessage = {
  controlInstance?: {
    sessionId: string;
    instructions: BrowserInstanceInstruction[];
  };
  manageInstance?: {
    action: 'updateInstance';
    instanceSessionId?: string;
    payload?: any;
  };
};

export type OutgoingTransportMessage = {
  browserInstance?: {
    sessionId: string;
    url?: string;
    action: 'postMessage';
    payload: any;
  };
  instanceManager?: {
    action: 'listInstance' | 'addInstance' | 'removeInstance';
    payload: any;
  };
  agent?: {
    action: 'info';
    payload: any;
  };
  extra?: any;
};
