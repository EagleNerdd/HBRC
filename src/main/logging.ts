import winston, { Logger } from 'winston';
import { ENVIRONMENT } from '@shared/constants';
import { getLogFilePath } from '@main/utils';

export const createLogger = (name: string, level: string) => {
  const filename = getLogFilePath(name);
  const logger = winston.createLogger({
    level,
    format: winston.format.json(),
    defaultMeta: { service: name },
    transports: [
      new winston.transports.File({ filename: `${filename}.error.log`, level: 'error' }),
      new winston.transports.File({ filename: `${filename}.log` }),
    ],
  });
  if (ENVIRONMENT.IS_DEBUG) {
    logger.add(
      new winston.transports.Console({
        format: winston.format.simple(),
      })
    );
  }
  return logger;
};

export { Logger };
