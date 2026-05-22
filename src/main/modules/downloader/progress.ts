import { dialog, BrowserWindow } from 'electron';
import { createLogger } from '@main/logging';

const logger = createLogger('downloader');

export type DownloadOptions = {
  title?: string;
  description?: string;
  download: (onProgress: (percent: number) => void, signal: AbortSignal) => Promise<void>;
};

export async function downloadWithProgress(window: BrowserWindow, options: DownloadOptions): Promise<boolean> {
  const { title = 'Downloading', description = 'Please wait...', download } = options;
  let progressWindow: BrowserWindow | null = null;
  const controller = new AbortController();
  let downloadComplete = false;

  try {
    progressWindow = new BrowserWindow({
      width: 420,
      height: 180,
      resizable: false,
      parent: window,
      modal: true,
      title,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    progressWindow.setMenuBarVisibility(false);

    progressWindow.on('close', () => {
      if (!downloadComplete) controller.abort();
    });

    const html = `<!DOCTYPE html><html><body style="margin:24px;font-family:system-ui;font-size:14px;overflow:hidden">
      <p style="margin:0 0 12px">${description}</p>
      <progress id="p" value="0" max="100" style="width:100%;height:20px"></progress>
      <p id="pct" style="margin:8px 0 0;text-align:center">0%</p>
    </body></html>`;
    await progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    window.setProgressBar(0);

    await download((percent) => {
      window.setProgressBar(percent / 100);
      if (progressWindow && !progressWindow.isDestroyed()) {
        const pct = Math.round(percent);
        progressWindow.webContents
          .executeJavaScript(
            `document.getElementById('p').value=${pct};document.getElementById('pct').textContent='${pct}%';`
          )
          .catch(() => {});
      }
    }, controller.signal);

    downloadComplete = true;
    window.setProgressBar(-1);
    progressWindow.close();
    progressWindow = null;
    return true;
  } catch (err: any) {
    window.setProgressBar(-1);
    if (progressWindow && !progressWindow.isDestroyed()) {
      downloadComplete = true;
      progressWindow.close();
    }

    if (controller.signal.aborted) {
      logger.info('download cancelled by user', { title });
      return false;
    }

    logger.error('download failed', { title, error: err.message });
    await dialog.showMessageBox(window, {
      type: 'error',
      buttons: ['OK'],
      message: `${title} failed`,
      detail: err.message,
    });
    return false;
  }
}
