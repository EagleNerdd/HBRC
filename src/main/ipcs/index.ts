import { BrowserWindow, ipcMain } from 'electron';
import {
  GET_INSTANCES,
  ADD_INSTANCE,
  UPDATE_INSTANCE,
  DELETE_INSTANCE,
  SHOW_INSTANCE_WINDOW,
  HIDE_INSTANCE_WINDOW,
  SET_APPLICATION_OPTIONS,
  CALL_INSTANCE_FUNCTION,
  GET_APPLICATION_INFO,
  START_INSTANCE,
  STOP_INSTANCE,
  TUNNEL_GET_STATE,
  TUNNEL_ACTIVATE,
  TUNNEL_DEACTIVATE,
  TUNNEL_DOWNLOAD,
} from '@shared/constants/ipcs';
import { Application } from '../app';
import { MainEventKey } from '@shared/event/main';

export const registerIPCs = (app: Application) => {
  // InstanceManager
  ipcMain.handle(GET_INSTANCES, async () => {
    return await app.getInstanceManager().getInstances();
  });

  ipcMain.handle(ADD_INSTANCE, async (...args) => {
    const [_, name, url, type] = args;
    return await app.getInstanceManager().addInstance(name, url, type);
  });
  ipcMain.handle(UPDATE_INSTANCE, async (...args) => {
    const [_, sessionId, updatedData, options] = args;
    return await app.getInstanceManager().updateInstance(sessionId, updatedData, options);
  });
  ipcMain.handle(DELETE_INSTANCE, async (...args) => {
    const [_, sessionId] = args;
    return await app.getInstanceManager().removeInstance(sessionId);
  });
  ipcMain.handle(SHOW_INSTANCE_WINDOW, async (...args) => {
    const [_, sessionId] = args;
    return await app.getInstanceManager().showInstanceWindow(sessionId);
  });
  ipcMain.handle(HIDE_INSTANCE_WINDOW, async (...args) => {
    const [_, sessionId] = args;
    return await app.getInstanceManager().hideInstanceWindow(sessionId);
  });
  ipcMain.handle(CALL_INSTANCE_FUNCTION, async (...args) => {
    const [_, sessionId, method, ...fArgs] = args;
    return await app.getInstanceManager().callInstanceFunction(sessionId, method, ...fArgs);
  });

  ipcMain.handle(START_INSTANCE, async (...args) => {
    const [_, sessionId] = args;
    await app.getInstanceManager().startInstance(sessionId);
  });

  ipcMain.handle(STOP_INSTANCE, async (...args) => {
    const [_, sessionId] = args;
    await app.getInstanceManager().stopInstance(sessionId);
  });
  // Application
  ipcMain.handle(SET_APPLICATION_OPTIONS, async (...args) => {
    const [_, options] = args;
    await app.setOptions(options);
  });

  ipcMain.handle(GET_APPLICATION_INFO, async (...args) => {
    return await app.getAppInfo();
  });

  // Tunnel
  ipcMain.handle(TUNNEL_GET_STATE, async () => {
    return await app.getTunnelState();
  });

  ipcMain.handle(TUNNEL_ACTIVATE, async (_, selectedProviders: string[]) => {
    await app.activateTunnel(selectedProviders);
  });

  ipcMain.handle(TUNNEL_DEACTIVATE, async () => {
    await app.deactivateTunnel();
  });

  ipcMain.handle(TUNNEL_DOWNLOAD, async (event, component: string) => {
    const tunnelWindow = BrowserWindow.fromWebContents(event.sender);
    return await app.getDownloadManager().download(component as any, tunnelWindow);
  });

  // Events
  ipcMain.on('main-event', (event, data) => {
    const { eventKey, eventData } = data || {};
    switch (eventKey) {
      case MainEventKey.CLICK_ENABLE_DEBUG:
        app.getEvents().onDebugEnableClicked.emit(app);
        break;
      case MainEventKey.TOGGLE_DEBUG:
        app.getEvents().onToggleDebugMode.emit(app);
        break;
      default:
        break;
    }
  });
};
