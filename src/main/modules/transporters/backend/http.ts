import axios, { AxiosInstance } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';
import { BaseTransporter, BaseTransporterOptions } from './base';

export type HttpTransporterOptions = {
  puller?: {
    url: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    intervalSeconds: number;
    retryOptions?: IAxiosRetryConfig;
  };
  pusher?: {
    url: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    retryOptions?: IAxiosRetryConfig;
  };
} & BaseTransporterOptions;

export class HttpTransporter extends BaseTransporter {
  private puller: AxiosInstance;
  private pusher: AxiosInstance;
  private interVal = undefined;

  constructor(
    protected name: string,
    protected readonly options: HttpTransporterOptions,
  ) {
    super(name, options);
    const retryDefaultOptions: IAxiosRetryConfig = {
      retries: 10,
      retryDelay: (n, e) => Math.min(30_000, axiosRetry.exponentialDelay(n, e)),
    };
    if (options.puller) {
      this.puller = axios.create({
        baseURL: options.puller.url,
        params: options.puller.params,
        headers: options.puller.headers,
      });
      axiosRetry(this.pusher, { ...retryDefaultOptions, ...options.puller.retryOptions });
    }
    if (options.pusher) {
      this.pusher = axios.create({
        baseURL: options.pusher.url,
        params: options.pusher.params,
        headers: options.pusher.headers,
      });
      axiosRetry(this.pusher, { ...retryDefaultOptions, ...options.pusher.retryOptions });
    }
  }

  protected _disconnect(): void {
    if (this.interVal) {
      clearInterval(this.interVal);
      this.interVal = undefined;
    }
  }

  protected _connect(): void {
    if (!this.options.puller) {
      return;
    }
    const { intervalSeconds } = this.options.puller;
    this.interVal = setInterval(async () => {
      try {
        const res = await this.puller.get('');
        if (this.onReceiveCallback) {
          this.onReceiveCallback(res.data);
        }
      } catch (e) {
        this.logger.error('receive message failed', { error: e.toString() });
      }
    }, intervalSeconds * 1000);
    this.onConnectedCallback && this.onConnectedCallback();
  }

  async _send(data: any) {
    if (!this.pusher) {
      this.logger.warn('pusher not defined so that ignore message', { data });
      return;
    }
    try {
      const resp = await this.pusher.post('', data);
      if (resp.status >= 400) {
        throw new Error(`message send failed: Status[${resp.status}] - StatusText[${resp.statusText}] - ${resp.data}`);
      }
      this.logger.debug('send message success', { data });
    } catch (e) {
      this.logger.error('send message failed', { data, error: e.toString() });
      throw e;
    }
  }
}
