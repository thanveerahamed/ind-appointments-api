import { IND_HOST } from './constants';
import { Agent, fetch as uFetch } from 'undici';

const dispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (input instanceof Request) {
    const { url, method, headers, body } = input;
    return uFetch(url, {
      ...init,
      method,
      headers,
      body,
      duplex: body ? 'half' : undefined,
      dispatcher,
    } as any);
  }
  return uFetch(
    input as any,
    { ...init, duplex: init?.body ? 'half' : undefined, dispatcher } as any,
  );
};

const getKy = async () => {
  const { default: ky } = await import('ky');
  return ky.create({ fetch: customFetch as any });
};

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

const buildSearchParams = (params: Record<string, string>): string => {
  const searchParams = new URLSearchParams(params).toString();
  return searchParams ? `?${searchParams}` : '';
};

export const apiGet = async <T>(
  path: string,
  params: Record<string, string> = {},
) => {
  const ky = await getKy();

  const response = await ky
    .get(`${IND_HOST}/${path}${buildSearchParams(params)}`, {
      headers: getDefaultHeaders('GET'),
      throwHttpErrors: false,
      retry: {
        limit: 3,
        methods: ['get'],
        statusCodes: [408, 500, 502, 503, 504],
      },
      timeout: 15000,
    })
    .text();

  const data = parseIndResponse(response);
  return data.data as T;
};

export const apiPost = async <T>(
  path: string,
  body: any,
  params: Record<string, string> = {},
) => {
  const ky = await getKy();

  const response = await ky
    .post(`${IND_HOST}/${path}${buildSearchParams(params)}`, {
      json: body,
      headers: getDefaultHeaders('POST'),
      throwHttpErrors: false,
      retry: {
        limit: 3,
        methods: ['post'],
        statusCodes: [408, 500, 502, 503, 504],
      },
      timeout: 15000,
    })
    .text();

  const data = parseIndResponse(response);
  return data.data as T;
};
