import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { Queue as BaseFileQueue } from 'file-queue';
import { OnMessageCallback, Queue } from '@shared/queue';
import { sleep } from '@shared/utils/time';
import { createLogger, Logger } from '@main/logging';

const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;

export class FileQueue implements Queue {
  private baseQueue?: BaseFileQueue;
  private messageCallback?: OnMessageCallback;
  private messageMaxRequeueNumber = -1;
  private messageRequeueMap = new Map<string, any>();
  private running = false;
  private maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS;
  private logger: Logger;

  constructor(
    private path: string,
    options: {
      messageMaxRequeueNumber?: number;
      maxRetryDelayMs?: number;
      name?: string;
    } = {}
  ) {
    if (options.messageMaxRequeueNumber !== undefined) {
      this.messageMaxRequeueNumber = options.messageMaxRequeueNumber;
    }
    if (options.maxRetryDelayMs !== undefined) {
      this.maxRetryDelayMs = options.maxRetryDelayMs;
    }
    this.logger = createLogger(`queue.${options.name ?? path}`);
    mkdirSync(path, { recursive: true });
  }

  onMessage(cb: OnMessageCallback) {
    this.messageCallback = (msgStore: any) => {
      return cb(msgStore.data);
    };
  }

  async clear(): Promise<void> {
    if (!this.baseQueue) {
      throw new Error('Queue not started');
    }
    this.baseQueue.clear();
  }

  stop(): void {
    this.running = false;
  }

  async start(): Promise<void> {
    if (this.baseQueue) return;
    this.baseQueue = await new Promise((resolve) => {
      const q = new BaseFileQueue(this.path, () => {
        resolve(q);
      });
    });

    this.running = true;
    setTimeout(async () => {
      while (this.running) {
        let tpopResult: { data?: any; commit: any; rollback: any };
        try {
          tpopResult = await this.tpop();
        } catch (e) {
          this.logger.error('tpop error', { error: e });
          await sleep(1000);
          continue;
        }

        const { data, commit, rollback } = tpopResult;
        if (!data) {
          await sleep(500);
          continue;
        }

        const { msgId } = data;
        try {
          if (this.messageCallback) {
            await this.messageCallback(data);
          }
          await commit();
          this.messageRequeueMap.delete(msgId);
        } catch (e) {
          const retryData = this.messageRequeueMap.get(msgId) ?? { retryCount: 0 };
          retryData.error = e;
          const shouldRequeue = this.messageMaxRequeueNumber < 0 || retryData.retryCount < this.messageMaxRequeueNumber;
          if (shouldRequeue) {
            retryData.retryCount++;
            this.messageRequeueMap.set(msgId, retryData);
            const delayTime = Math.min(Math.pow(2, retryData.retryCount) * 1000, this.maxRetryDelayMs);
            this.logger.warn('retrying message', { retryCount: retryData.retryCount, error: e?.message ?? e, data });
            setTimeout(async () => {
              try {
                await rollback();
              } catch (rollbackErr) {
                this.logger.error('rollback error', { error: rollbackErr });
              }
            }, delayTime);
          } else {
            this.logger.error('message dropped after max retries', {
              retryCount: retryData.retryCount,
              error: e?.message ?? e,
              data,
            });
            await commit();
            this.messageRequeueMap.delete(msgId);
          }
        }
      }
    });
  }

  async tpop(): Promise<{ err?: any; data?: any; commit: any; rollback: any }> {
    return new Promise((resolve, reject) => {
      if (!this.baseQueue) {
        reject(new Error('Queue not started'));
      }
      this.baseQueue.tpop((err: any, data: any, commit: any, rollback: any) => {
        const commitFn = async () => {
          await new Promise((commitResolve, commitReject) => {
            commit((err: any) => {
              if (!err) {
                commitResolve(null);
              } else {
                commitReject(err);
              }
            });
          });
        };
        const rollbackFn = async () => {
          await new Promise((rollbackResolve, rollbackReject) => {
            rollback((err: any) => {
              if (!err) {
                rollbackResolve(null);
              } else {
                rollbackReject(err);
              }
            });
          });
        };
        if (err) {
          reject({
            err,
            commit: commitFn,
            rollback: rollbackFn,
          });
        } else {
          resolve({ data, commit: commitFn, rollback: rollbackFn });
        }
      });
    });
  }

  async pop(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.baseQueue) {
        reject(new Error('Queue not started'));
      }
      this.baseQueue.pop((err: any, data: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async push(data: any) {
    if (!this.baseQueue) {
      throw new Error('Queue not started');
    }
    const storeData = {
      msgId: randomUUID().toString(),
      data,
    };
    await new Promise((resolve, reject) => {
      this.baseQueue.push(storeData, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}
