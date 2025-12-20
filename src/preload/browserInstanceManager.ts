import { contextBridge, ipcRenderer } from 'electron';
import {
  ADD_INSTANCE,
  DELETE_INSTANCE,
  GET_INSTANCES,
  SHOW_INSTANCE_WINDOW,
  HIDE_INSTANCE_WINDOW,
  CALL_INSTANCE_FUNCTION,
  START_INSTANCE,
  STOP_INSTANCE,
  UPDATE_INSTANCE,
} from '@shared/constants/ipcs';

contextBridge.exposeInMainWorld('browserInstanceManagerAPI', {
  getInstances: () => ipcRenderer.invoke(GET_INSTANCES),
  addInstance: (name: string, url: string, type: string) => ipcRenderer.invoke(ADD_INSTANCE, name, url, type),
  updateInstance: (
    sessionId: string,
    payload: {
      attributes?: Record<string, string>;
    },
    options?: {
      restart?: boolean;
      notifyToTransporter?: boolean;
      notifyToRenderer?: boolean;
    }
  ) => ipcRenderer.invoke(UPDATE_INSTANCE, sessionId, payload, options),
  deleteInstance: (sessionId: string) => ipcRenderer.invoke(DELETE_INSTANCE, sessionId),
  showInstanceWindow: (sessionId: string) => ipcRenderer.invoke(SHOW_INSTANCE_WINDOW, sessionId),
  hideInstanceWindow: (sessionId: string) => ipcRenderer.invoke(HIDE_INSTANCE_WINDOW, sessionId),
  callInstanceFunction: (sessionId: string, method: string, ...args: any[]) =>
    ipcRenderer.invoke(CALL_INSTANCE_FUNCTION, sessionId, method, ...args),
  startInstance: (sessionId: string) => ipcRenderer.invoke(START_INSTANCE, sessionId),
  stopInstance: (sessionId: string) => ipcRenderer.invoke(STOP_INSTANCE, sessionId),
  startAllInstances: () => ipcRenderer.invoke(START_INSTANCE, 'all'),
});
