import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { BaseTunnelProvider } from './base';
import { FrpDownloadComponent } from '../../downloader/components/frp';

export type FrpTunnelOptions = {
  name: string;
  serverAddr: string;
  serverPort?: number;
  token?: string;
  remotePort: number;
};

const START_TIMEOUT_MS = 30_000;
const SUCCESS_PATTERN = /start proxy success/;

export class FrpTunnelProvider extends BaseTunnelProvider {
  private process: ChildProcess | null = null;
  private configPath: string | null = null;
  private readonly frpc = new FrpDownloadComponent();

  constructor(private readonly options: FrpTunnelOptions) {
    super('frp');
  }

  async start(localPort: number): Promise<string> {
    const { serverAddr, serverPort = 7000, token, remotePort, name } = this.options;

    this.configPath = path.join(os.tmpdir(), `hbrc-frpc-${Date.now()}.toml`);
    const config = [
      `serverAddr = "${serverAddr}"`,
      `serverPort = ${serverPort}`,
      ...(token ? [`auth.method = "token"`, `auth.token = "${token}"`] : []),
      ``,
      `[[proxies]]`,
      `name = "${name}"`,
      `type = "tcp"`,
      `localIP = "127.0.0.1"`,
      `localPort = ${localPort}`,
      `remotePort = ${remotePort}`,
    ].join('\n');

    await fs.promises.writeFile(this.configPath, config, 'utf-8');

    const bin = this.frpc.getBinaryPath();

    return new Promise((resolve, reject) => {
      this.process = spawn(bin, ['-c', this.configPath!]);

      const timeout = setTimeout(() => {
        this.process?.kill();
        reject(new Error('frp tunnel timed out waiting for connection'));
      }, START_TIMEOUT_MS);

      const onData = (data: Buffer) => {
        const text = data.toString();
        this.logger.debug('frpc output', { text });
        if (SUCCESS_PATTERN.test(text)) {
          clearTimeout(timeout);
          resolve(`http://${serverAddr}:${remotePort}`);
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData);

      this.process.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          reject(new Error(`frpc exited with code ${code}`));
        }
        this.disconnectedCallback?.();
      });
    });
  }

  async stop(): Promise<void> {
    this.process?.kill();
    this.process = null;
    if (this.configPath) {
      await fs.promises.unlink(this.configPath).catch(() => {});
      this.configPath = null;
    }
  }
}
