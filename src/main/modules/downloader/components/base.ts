import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createLogger, Logger } from '@main/logging';

const execFileAsync = promisify(execFile);

export type DownloadInfo = {
  url: string;
  filename: string;
  isTarball: boolean;
};

export abstract class DownloadComponent {
  protected readonly logger: Logger;

  constructor(
    protected readonly name: string,
    public readonly restartAfterDownload: boolean
  ) {
    this.logger = createLogger(`downloader.${name}`);
  }

  protected abstract getDownloadInfo(): DownloadInfo;

  getBinDir(): string {
    return path.join(app.getPath('userData'), 'binaries');
  }

  getBinaryPath(): string {
    return path.join(this.getBinDir(), this.getDownloadInfo().filename);
  }

  async isDownloaded(): Promise<boolean> {
    try {
      await fs.promises.access(this.getBinaryPath(), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async download(
    onSuccess?: () => Promise<void>,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const { url, filename, isTarball } = this.getDownloadInfo();
    const binDir = this.getBinDir();
    await fs.promises.mkdir(binDir, { recursive: true });

    const tmpFilename = isTarball ? path.basename(url) : filename;
    const downloadPath = path.join(binDir, tmpFilename);
    const binPath = path.join(binDir, filename);

    this.logger.info('downloading', { url });

    const response = await axios({ method: 'get', url, responseType: 'stream', maxRedirects: 10, signal });
    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(downloadPath);

      const onAbort = () => {
        response.data.destroy();
        writer.destroy();
        fs.promises.unlink(downloadPath).catch(() => {});
        reject(Object.assign(new Error('Download cancelled'), { cancelled: true }));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalLength > 0) onProgress?.(Math.round((downloaded / totalLength) * 100));
      });
      response.data.pipe(writer);
      writer.on('finish', () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      });
      writer.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
    });

    if (isTarball) {
      await execFileAsync('tar', ['-xzf', downloadPath, '-C', binDir]);
      await fs.promises.unlink(downloadPath);
    }

    if (process.platform !== 'win32') {
      await fs.promises.chmod(binPath, 0o755);
    }

    this.logger.info('downloaded successfully', { binPath });
    if (onSuccess) {
      await onSuccess();
    }
  }
}
