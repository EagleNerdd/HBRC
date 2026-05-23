import { BrowserInstance, BrowserInstanceInstruction } from './browserInstance';

export type UpdateInstancePayload = Partial<
  Pick<BrowserInstance, 'sessionId' | 'name' | 'initInstructions' | 'attributePresets' | 'attributes'>
>;

export type IncomingTransportMessage = {
  controlInstance?: {
    sessionId: string;
    instructions: BrowserInstanceInstruction[];
  };
  manageInstance?: {
    action: 'updateInstance';
    payload?: UpdateInstancePayload; // Because manageInstance can manage multi instances so that sessionId should in payload
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
    action: 'listInstance' | 'addInstance' | 'removeInstance' | 'updateInstance';
    payload: any;
  };
  agent?: {
    action: 'info';
    payload: any;
  };
  extra?: any;
};
