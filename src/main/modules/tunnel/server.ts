import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { IncomingTransportMessage } from '@shared/types/message';
import { createLogger } from '@main/logging';
import { AppError } from '@shared/errors';

export type MessageHandler = (message: IncomingTransportMessage) => Promise<any>;

export class TunnelHttpServer {
  private fastify: FastifyInstance;
  private logger = createLogger('tunnel.server');

  constructor(private readonly onMessage: MessageHandler) {
    this.fastify = Fastify({ logger: false });
    this.registerRoutes();
  }

  private registerRoutes() {
    this.fastify.post<{ Body: IncomingTransportMessage }>('/messages', async (request, reply) => {
      const message = request.body;
      const rqId = randomUUID();
      this.logger.debug(`http request(${rqId}): ${JSON.stringify(message)}`);
      try {
        const result = await this.onMessage(message);
        const resp = { success: true, data: result };
        this.logger.debug(`http response(${rqId}): ${JSON.stringify(resp)}`);
        return reply.status(200).send(resp);
      } catch (err: any) {
        this.logger.error(`http error(${rqId}): ${err.message}`);
        const isAppError = err instanceof AppError;
        const statusCode = isAppError ? (err.httpStatusCode ?? 500) : 500;
        const code = isAppError ? err.code : 'unknown';
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: code,
            message: err.message,
          },
        });
      }
    });

    this.fastify.get('/health', async (_request, reply) => {
      return reply.status(200).send({ status: 'ok' });
    });
  }

  async listen(port: number): Promise<void> {
    await this.fastify.listen({ port, host: '127.0.0.1' });
    this.logger.info('tunnel http server listening', { port });
  }

  async close(): Promise<void> {
    await this.fastify.close();
  }
}
