import { IND_HOST } from './constants';
import type { IndResponse } from './types';
import { Agent, fetch as undiciFetch } from 'undici';
import { logError, logInfo } from '../../../logging';

const dispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
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

const getErrorChain = (error: unknown): Record<string, unknown>[] => {
  const chain: Record<string, unknown>[] = [];
  let current = error;
  let depth = 0;

  while (typeof current === 'object' && current !== null && depth < 5) {
    const item: Record<string, unknown> = {};
    for (const key of [
      'name',
      'message',
      'code',
      'syscall',
      'address',
      'port',
      'stack',
    ]) {
      if (key in current) item[key] = current[key as keyof typeof current];
    }
    chain.push(item);
    current = 'cause' in current ? current.cause : undefined;
    depth++;
  }

  return chain;
};

const isRetryableError = (error: unknown): boolean =>
  getErrorChain(error).some(({ code }) =>
    [
      'ECONNRESET',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ERR_NETWORK',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
      'UND_ERR_SOCKET',
      'ABORT_ERR',
    ].includes(typeof code === 'string' ? code : ''),
  );

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
  return request<T>('GET', path, undefined, params);
};

export const apiPost = async <T>(
  path: string,
  body: any,
  params: Record<string, string> = {},
) => {
  return request<T>('POST', path, body, params);
};

const request = async <T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  params: Record<string, string>,
): Promise<T> => {
  const url = new URL(`${IND_HOST}/${path}`);
  url.search = new URLSearchParams(params).toString();

  const retries = 3;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const startedAt = Date.now();
    let status: number | undefined;
    let responseBody: string | undefined;

    try {
      const response = await undiciFetch(url, {
        method,
        headers: getDefaultHeaders(method),
        body: body === undefined ? undefined : JSON.stringify(body),
        dispatcher,
        signal: AbortSignal.timeout(15000),
      });
      status = response.status;
      responseBody = await response.text();
      const result = handleIndResponse<T>(responseBody);

      logInfo(
        {
          method,
          host: url.host,
          path: url.pathname,
          query: url.search,
          status,
          durationMs: Date.now() - startedAt,
          attempt: attempt + 1,
        },
        'IND request succeeded',
      );
      return result;
    } catch (error) {
      const retryable = isRetryableError(error);
      const shouldRetry = retryable && attempt < retries;
      const delayMs = 1000 * Math.pow(2, attempt);

      logError(
        {
          method,
          host: url.host,
          path: url.pathname,
          query: url.search,
          status,
          responseBodySnippet: responseBody?.slice(0, 500),
          durationMs: Date.now() - startedAt,
          attempt: attempt + 1,
          maxAttempts: retries + 1,
          retryable,
          retryDelayMs: shouldRetry ? delayMs : undefined,
          error: getErrorChain(error),
        },
        'IND request failed',
      );

      if (!shouldRetry) throw error;
      await delay(delayMs);
    }
  }
  throw new Error('Retry failed');
};
