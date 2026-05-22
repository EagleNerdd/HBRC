import { DownloadComponent, DownloadInfo } from './base';

export class CloudflaredDownloadComponent extends DownloadComponent {
  constructor() {
    super('cloudflared', false);
  }

  protected getDownloadInfo(): DownloadInfo {
    const { platform, arch } = process;

    if (platform === 'win32') {
      return {
        url: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
        filename: 'cloudflared.exe',
        isTarball: false,
      };
    }

    if (platform === 'darwin') {
      const archStr = arch === 'arm64' ? 'arm64' : 'amd64';
      return {
        url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${archStr}.tgz`,
        filename: 'cloudflared',
        isTarball: true,
      };
    }

    const archStr = arch === 'arm64' ? 'arm64' : 'amd64';
    return {
      url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${archStr}`,
      filename: 'cloudflared',
      isTarball: false,
    };
  }
}
