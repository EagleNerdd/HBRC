import { contextBridge, ipcRenderer } from 'electron';
import {
  GET_APPLICATION_INFO,
  SET_APPLICATION_OPTIONS,
  ON_MENU_ITEM_CLICKED,
  ON_MENU_ITEM_PROCESSED,
  ON_APPLICATION_READY,
  ON_SERVER_DISCONNECTED,
  ON_TRANSPORTER_STATUS_CHANGED,
  ON_INSTANCE_UPDATED,
} from '@shared/constants/ipcs';
import { MenuItemId } from '@shared/constants';
import { PreloadEventKey, PreloadEventListener } from '@shared/event/preload';
import { PreloadEvents } from './events';
import { TransporterStatus } from '@shared/types/transporter';
import { MainEventKey } from '@shared/event/main';

const preloadEvents = new PreloadEvents();

ipcRenderer.on(ON_MENU_ITEM_CLICKED, (_, menuItemId, data: any) => {
  preloadEvents.emitMenuItemClickEvent(menuItemId, data);
});

ipcRenderer.on(ON_MENU_ITEM_PROCESSED, (_, menuItemId, data: any) => {
  preloadEvents.emitMenuItemProcessedEvent(menuItemId, data);
});

ipcRenderer.on(ON_APPLICATION_READY, () => {
  preloadEvents.emit(PreloadEventKey.APPLICATION_READY);
});

ipcRenderer.on(ON_SERVER_DISCONNECTED, () => {
  preloadEvents.emit(PreloadEventKey.SERVER_DISCONNECTED);
});

ipcRenderer.on(ON_TRANSPORTER_STATUS_CHANGED, (_, status: TransporterStatus) => {
  preloadEvents.emit(PreloadEventKey.TRANSPORTER_STATUS_CHANGED, status);
});

ipcRenderer.on(ON_INSTANCE_UPDATED, (_, data: any) => {
  preloadEvents.emit(PreloadEventKey.INSTANCE_UPDATED, data);
});

contextBridge.exposeInMainWorld('applicationAPI', {
  setApplicationOptions: (options: any) => ipcRenderer.invoke(SET_APPLICATION_OPTIONS, options),
  getApplicationInfo: () => ipcRenderer.invoke(GET_APPLICATION_INFO),
  subscribeEvent: <D>(eventKey: PreloadEventKey, callback: PreloadEventListener<D>) => {
    return preloadEvents.subscribe(eventKey, callback);
  },
  subscribeEvents: (eventKeys: PreloadEventKey[], callback: PreloadEventListener<any>) => {
    return preloadEvents.subscribeMulti(eventKeys, callback);
  },
  unsubscribeEvent: (subscriptionId: number) => {
    preloadEvents.unsubscribe(subscriptionId);
  },
  unsubscribeEvents: (subscriptionId: number[]) => {
    preloadEvents.unsubscribeMulti(subscriptionId);
  },
  onMenuItemClick: <D>(menuItemId: MenuItemId, callback: PreloadEventListener<D>) => {
    return preloadEvents.subscribeMenuItemClickEvent<D>(menuItemId, callback);
  },
  onMenuItemProcessed: <D>(menuItemId: MenuItemId, callback: PreloadEventListener<D>) => {
    return preloadEvents.subscribeMenuItemProcessedEvent<D>(menuItemId, callback);
  },
  emitMainEvent: (eventKey: MainEventKey, data: any) => {
    ipcRenderer.send('main-event', { eventKey, eventData: data });
  },
});
