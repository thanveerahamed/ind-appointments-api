import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logError, logInfo } from './common/logging';
import { indApiRouter } from './indApi/indApi.router';

dotenv.config();

const startServer = async (): Promise<void> => {
  if (!process.env.PORT) {
    process.exit(1);
    return;
  }

  try {
    const PORT: number = parseInt(process.env.PORT as string, 10);

    const expressApp = express();
    expressApp.use(helmet());
    expressApp.use(cors());
    expressApp.use(express.json());

    expressApp.use('/ind-api', indApiRouter);

    expressApp.listen(PORT, () => {
      logInfo(`Listening on port ${PORT}`);
    });
  } catch (error: any) {
    logError('Startup error', { error });
  }
};

startServer()
  .then(() => {
    logInfo('Server started');
  })
  .catch((error) => {
    logError('Unable to start the server. Reason: ' + error.message);
  });
