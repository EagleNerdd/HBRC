import { BrowserWindow } from 'electron';
import { createWindow } from '@main/factories';
import { ENVIRONMENT } from '@shared/constants';
import { PRELOAD_FILE_PATH } from '@main/config';

export function TunnelConfigWindow(parent?: BrowserWindow) {
  return createWindow({
    id: 'tunnelConfig',
    isSingleInstance: true,
    keepOpen: false,
    title: 'Configure Tunnel',
    width: 480,
    height: 520,
    resizable: false,
    show: true,
    center: true,
    movable: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    parent,
    modal: !!parent,

    webPreferences: {
      webSecurity: !ENVIRONMENT.IS_DEBUG,
      preload: PRELOAD_FILE_PATH,
    },
  });
}
