import { IND_HOST } from './constants';
import { IndResponse } from './types';

const getKy = async () => {
  const { default: ky } = await import('ky');
  return ky;
};

export const parseIndResponse = (response: string) =>
  JSON.parse(response.replace(")]}',\n", ''));

const getDefaultHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'oap-locale': 'en',
});

const buildSearchParams = (params: Record<string, string>): string => {
  const searchParams = new URLSearchParams(params).toString();
  return searchParams ? `?${searchParams}` : '';
};

export const makeFetchCall = async <T>({
  path,
  requestInit = {},
}: {
  path: string;
  requestInit?: RequestInit;
}): Promise<T> => {
  const ky = await getKy();
  console.log(path, requestInit);

  const response = await ky(`${IND_HOST}/${path}`, {
    ...requestInit,
    retry: { limit: 3, methods: ['get', 'post'], statusCodes: [408, 500, 502, 503, 504] },
    timeout: 15000,
  });

  const responseString = await response.text();
  const jsonResult = parseIndResponse(responseString) as IndResponse;

  if (response.status !== 200 || jsonResult.status !== 'OK') {
    throw new Error((jsonResult.error as string) ?? 'Unknown error');
  }

  return jsonResult.data as T;
};

export const apiGet = async <T>(
  path: string,
  params: Record<string, string> = {},
) => {
  const ky = await getKy();

  const response = await ky
    .get(`${IND_HOST}/${path}${buildSearchParams(params)}`, {
      headers: getDefaultHeaders(),
      retry: { limit: 3, methods: ['get'], statusCodes: [408, 500, 502, 503, 504] },
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
      headers: getDefaultHeaders(),
      retry: { limit: 3, methods: ['post'], statusCodes: [408, 500, 502, 503, 504] },
      timeout: 15000,
    })
    .text();

  const data = parseIndResponse(response);
  return data.data as T;
};

