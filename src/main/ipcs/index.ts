import { ipcMain } from 'electron';
import {
  GET_INSTANCES,
  ADD_INSTANCE,
  DELETE_INSTANCE,
  SHOW_INSTANCE_WINDOW,
  SET_APPLICATION_OPTIONS,
  CALL_INSTANCE_FUNCTION,
  GET_APPLICATION_INFO,
  START_INSTANCE,
  STOP_INSTANCE,
} from '@shared/constants/ipcs';
import { Application } from '../app';
import { MainEventKey } from '@shared/event/main';

export const registerIPCs = (app: Application) => {
  // InstanceManager
  ipcMain.handle(GET_INSTANCES, async () => {
    return await app.getInstanceManager().getInstances();
  });

  ipcMain.handle(ADD_INSTANCE, async (...args) => {
    const [_, name, url] = args;
    return await app.getInstanceManager().addInstance(name, url);
  });
  ipcMain.handle(DELETE_INSTANCE, async (...args) => {
    const [_, sessionId] = args;
    return await app.getInstanceManager().removeInstance(sessionId);
  });
  ipcMain.handle(SHOW_INSTANCE_WINDOW, async (...args) => {
    const [_, sessionId] = args;
    return await app.getInstanceManager().showInstanceWindow(sessionId);
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
