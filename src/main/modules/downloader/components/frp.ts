import fs from 'fs';
import path from 'path';
import { DownloadComponent, DownloadInfo } from './base';

const FRP_VERSION = '0.69.0';

export class FrpDownloadComponent extends DownloadComponent {
  constructor() {
    super('frpc', false);
  }

  protected getDownloadInfo(): DownloadInfo {
    const { platform, arch } = process;
    const archStr = arch === 'arm64' ? 'arm64' : 'amd64';

    if (platform === 'win32') {
      return {
        url: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_windows_amd64.zip`,
        filename: 'frpc.exe',
        isZip: true,
      };
    }

    if (platform === 'darwin') {
      return {
        url: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_darwin_${archStr}.tar.gz`,
        filename: 'frpc',
        isTarball: true,
      };
    }

    return {
      url: `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_${archStr}.tar.gz`,
      filename: 'frpc',
      isTarball: true,
    };
  }

  protected async onAfterExtract(binDir: string): Promise<void> {
    const { platform, arch } = process;
    const archStr = arch === 'arm64' ? 'arm64' : 'amd64';
    const osStr = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : 'linux';
    const binaryName = platform === 'win32' ? 'frpc.exe' : 'frpc';
    const subDir = path.join(binDir, `frp_${FRP_VERSION}_${osStr}_${archStr}`);

    await fs.promises.copyFile(path.join(subDir, binaryName), path.join(binDir, binaryName));
    await fs.promises.rm(subDir, { recursive: true, force: true });
  }
}
