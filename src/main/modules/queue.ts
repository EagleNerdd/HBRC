import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { Queue as BaseFileQueue } from 'file-queue';
import { OnMessageCallback, Queue } from '@shared/queue';
import { sleep } from '@shared/utils/time';

export class FileQueue implements Queue {
  private baseQueue?: BaseFileQueue;
  private messageCallback?: OnMessageCallback;
  private messageMaxRequeueNumber = -1;
  private messageRequeueMap = new Map<string, any>();
  constructor(
    private path: string,
    options: {
      messageMaxRequeueNumber?: number;
    } = {}
  ) {
    if (options.messageMaxRequeueNumber !== undefined) {
      this.messageMaxRequeueNumber = options.messageMaxRequeueNumber;
    }
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

  async start(): Promise<void> {
    if (this.baseQueue) return;
    this.baseQueue = await new Promise((resolve, reject) => {
      const q = new BaseFileQueue(this.path, (...args: any) => {
        resolve(q);
      });
    });

    setTimeout(async () => {
      while (true) {
        const { data, err, commit, rollback } = await this.tpop();
        // console.log('pop data', data);
        const { msgId } = data;
        if (!data || err) {
          await sleep(500);
        } else {
          try {
            if (this.messageCallback) {
              await this.messageCallback(data);
            }
            // console.log('queue commit', data);
            await commit();
          } catch (e) {
            const retryData = this.messageRequeueMap.get(msgId) || {
              retryCount: 0,
            };
            retryData.error = e;
            const shouldRequeue =
              this.messageMaxRequeueNumber < 0 || retryData.retryCount < this.messageMaxRequeueNumber;
            if (shouldRequeue) {
              retryData.retryCount++;
              this.messageRequeueMap.set(msgId, retryData);
              const delayTime = Math.pow(2, retryData.retryCount) * 1000;
              // console.debug('requeue message', { delayTime, retryData, data });
              setTimeout(async () => {
                await rollback();
              }, delayTime);
            } else {
              await commit();
              this.messageRequeueMap.delete(msgId);
            }
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
