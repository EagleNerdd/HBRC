import { BrowserWindow, app, shell } from 'electron';

import { createWindow } from '@main/factories';
import { ENVIRONMENT, MenuItemId } from '@shared/constants';
import { PRELOAD_FILE_PATH } from '@main/config';
import { initMenuForMainWindow } from '@main/menu';
import { HBRCApplication } from '@main/app';
import { isDebug } from '@main/utils';

export async function MainWindow(mainApp: HBRCApplication) {
  const mainWindow = createWindow({
    id: 'main',
    title: 'Headless Browser Remote Controller',
    width: 1200,
    height: 720,
    show: true,
    center: true,
    movable: true,
    resizable: true,
    alwaysOnTop: false,
    autoHideMenuBar: false,

    webPreferences: {
      webSecurity: !ENVIRONMENT.IS_DEBUG,
      preload: PRELOAD_FILE_PATH,
    },
  });

  const autoOpenDevTools = ENVIRONMENT.IS_DEBUG && isDebug();

  mainWindow.webContents.on('did-finish-load', () => {
    if (autoOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'undocked' });
    }
  });

  initMenuForMainWindow(app, mainApp, mainWindow, {
    excludeMenuItemIds: [MenuItemId.SERVER, MenuItemId.MANAGE],
  });

  mainWindow.on('close', () => BrowserWindow.getAllWindows().forEach((window) => window.destroy()));

  return mainWindow;
}
