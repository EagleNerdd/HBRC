import winston, { Logger } from 'winston';
import { getLogFilePath } from '@main/utils';
import { app } from 'electron';

const loggers: Record<string, Logger> = {};

export const setLoggerLevel = (level: string) => {
  for (const logger of Object.values(loggers)) {
    logger.level = level;
  }
};

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
  if (!app.isPackaged) {
    logger.add(
      new winston.transports.Console({
        format: winston.format.simple(),
      })
    );
  }
  loggers[name] = logger;
  return logger;
};

export { Logger };
