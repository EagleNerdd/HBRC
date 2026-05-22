import path from 'path';

import { BrowserWindow, app } from 'electron';
import { WindowProps } from '@shared/types';
import { createFileRoute, createURLRoute } from 'electron-router-dom';
import { ENVIRONMENT } from '@shared/constants';

const singleInstanceMap = new Map<string, BrowserWindow>();

function getAppIcon() {
  const appPath = app.getAppPath();
  if (process.platform === 'win32') return path.join(appPath, 'assets/icon.ico');
  if (process.platform === 'darwin') return path.join(appPath, 'assets/hbrc_icon.icns');
  return path.join(appPath, 'assets/icon.png');
}

export function createWindow({ id, isSingleInstance, keepOpen, ...settings }: WindowProps) {
  if (isSingleInstance && singleInstanceMap.has(id)) {
    const window = singleInstanceMap.get(id);
    window.show();
    return window;
  }
  const window = new BrowserWindow({ icon: getAppIcon(), ...settings });

  const devServerURL = createURLRoute(process.env['ELECTRON_RENDERER_URL']!, id);

  const fileRoute = createFileRoute(path.join(__dirname, '../renderer/index.html'), id);

  ENVIRONMENT.IS_LOCAL ? window.loadURL(devServerURL) : window.loadFile(...fileRoute);

  if (isSingleInstance) {
    singleInstanceMap.set(id, window);
  }
  if (keepOpen) {
    window.on('close', (e) => {
      e.preventDefault();
      window.hide();
    });
  } else {
    window.on('closed', () => {
      if (isSingleInstance) {
        singleInstanceMap.delete(id);
      }
      window.destroy();
    });
  }

  return window;
}
