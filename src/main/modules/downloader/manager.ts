import { app, dialog, BrowserWindow } from 'electron';
import { CloudflaredDownloadComponent } from './components/cloudflared';
import { downloadWithProgress } from './progress';
import { DownloadComponent } from './components/base';

const downloadComponents = {
  cloudflared: new CloudflaredDownloadComponent(),
};

type DownloadComponentType = keyof typeof downloadComponents;

export class DownloadManager {
  constructor(private readonly getWindow: () => BrowserWindow | undefined) {}

  async isDownloaded(component: DownloadComponentType): Promise<boolean> {
    const comp: DownloadComponent = downloadComponents[component];
    if (!comp) throw new Error(`Unknown download component: ${component}`);
    return comp.isDownloaded();
  }

  async getBinaryPath(component: DownloadComponentType) {
    const comp: DownloadComponent = downloadComponents[component];
    if (!comp) throw new Error(`Unknown download component: ${component}`);
    return comp.getBinaryPath();
  }

  async download(component: DownloadComponentType): Promise<boolean> {
    const window = this.getWindow();
    if (!window) throw new Error('No main window available');

    const comp = downloadComponents[component];
    if (!comp) throw new Error(`Unknown download component: ${component}`);

    if (await comp.isDownloaded()) {
      await dialog.showMessageBox(window, {
        type: 'info',
        buttons: ['OK'],
        message: `${component} is already installed`,
      });
      return false;
    }

    const onSuccess = async () => {
      if (comp.restartAfterDownload) {
        await dialog.showMessageBox(this.getWindow()!, {
          type: 'info',
          buttons: ['Restart'],
          message: 'Download complete',
          detail: component + ' has been downloaded successfully. The app will now restart.',
        });
        app.relaunch();
        app.quit();
      }
    };

    return downloadWithProgress(window, {
      title: `Downloading ${component}`,
      description: `Downloading ${component}, please wait...`,
      download: (onProgress, signal) => comp.download(onSuccess, onProgress, signal),
    });
  }
}
