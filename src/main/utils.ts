import { app } from 'electron';
import path from 'path';

const getDataPath = (...paths: any[]) => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data', ...paths);
  } else {
    return path.join(app.getAppPath(), 'out', 'data', ...paths);
  }
};

const getLogFilePath = (...paths: any[]) => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'logs', ...paths);
  } else {
    return path.join(app.getAppPath(), 'out', 'logs', ...paths);
  }
};

export { getDataPath, getLogFilePath };
