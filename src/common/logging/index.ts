import bunyan from 'bunyan';
import { LoggingBunyan } from '@google-cloud/logging-bunyan';

const loggingBunyan = new LoggingBunyan();
const logger = bunyan.createLogger({
  // The JSON payload of the log as it appears in Cloud Logging
  // will contain "name": "my-service"
  name: 'ind-app-node-api',
  streams: [
    // Log to the console at 'info' and above
    { stream: process.stdout, level: 'info' },
    // And log to Cloud Logging, logging at 'info' and above
    loggingBunyan.stream('info'),
  ],
});

export const logInfo = (message: any, ...params: any[]) =>
  logger.info(message, ...params);
export const logError = (message: any, ...params: any[]) =>
  logger.error(message, ...params);
