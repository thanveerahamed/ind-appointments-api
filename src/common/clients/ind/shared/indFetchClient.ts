import { IND_HOST } from './constants';
import type { IndResponse } from './types';
import { Agent, fetch as undiciFetch } from 'undici';

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

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;

  const cause = 'cause' in error ? error.cause : undefined;
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    typeof cause.code === 'string'
  ) {
    return cause.code;
  }
  return undefined;
};

const isRetryableError = (error: unknown): boolean =>
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
  ].includes(getErrorCode(error) ?? '');

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
    try {
      const response = await undiciFetch(url, {
        method,
        headers: getDefaultHeaders(method),
        body: body === undefined ? undefined : JSON.stringify(body),
        dispatcher,
        signal: AbortSignal.timeout(15000),
      });
      const responseBody = await response.text();
      return handleIndResponse<T>(responseBody);
    } catch (error) {
      if (!isRetryableError(error) || attempt === retries) throw error;
      await delay(1000 * Math.pow(2, attempt));
    }
  }
  throw new Error('Retry failed');
};
