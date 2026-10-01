import { IND_HOST } from './constants';
import type { IndResponse } from './types';
import axios, { AxiosError } from 'axios';
import https from 'node:https';

const axiosClient = axios.create({
  baseURL: IND_HOST,
  timeout: 15000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  validateStatus: () => true,
});

export const parseIndResponse = (response: string) =>
  JSON.parse(response.replace(")]}',\n", ''));

const getDefaultHeaders = (
  method: 'GET' | 'POST' = 'GET',
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'oap-locale': 'en',
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  backoff = 1000,
): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof AxiosError &&
        (err.code === 'ECONNRESET' ||
          err.code === 'ECONNABORTED' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ERR_NETWORK' ||
          (err.response?.status && err.response.status >= 500));

      if (!isRetryable || attempt === retries) throw err;
      await delay(backoff * Math.pow(2, attempt));
    }
  }
  throw new Error('Retry failed');
};

const handleIndResponse = <T>(responseData: string | object): T => {
  const parsed = (
    typeof responseData === 'string'
      ? parseIndResponse(responseData)
      : responseData
  ) as IndResponse;

  if (parsed.status !== 'OK') {
    const rawMessage = parsed.errorCode ?? parsed.error ?? 'Unknown error';
    const message =
      typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);
    const error = new Error(message);
    (error as any).code = parsed.errorCode;
    (error as any).data = parsed.data;
    throw error;
  }

  return parsed.data as T;
};

export const apiGet = async <T>(
  path: string,
  params: Record<string, string> = {},
) => {
  return withRetry(async () => {
    const response = await axiosClient.get(`/${path}`, {
      headers: getDefaultHeaders('GET'),
      params,
    });

    return handleIndResponse<T>(response.data);
  });
};

export const apiPost = async <T>(
  path: string,
  body: any,
  params: Record<string, string> = {},
) => {
  return withRetry(async () => {
    const response = await axiosClient.post(`/${path}`, body, {
      headers: getDefaultHeaders('POST'),
      params,
    });

    return handleIndResponse<T>(response.data);
  });
};
