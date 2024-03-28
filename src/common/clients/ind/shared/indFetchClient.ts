import { IND_HOST } from './constants';
import { IndResponse } from './types';
import axios from 'axios';
import { logError } from '../../../logging';

export const parseIndResponse = (response: string) =>
  JSON.parse(response.replace(")]}',\n", ''));
export const makeFetchCall = async <T>({
  path,
  requestInit = {},
}: {
  path: string;
  requestInit?: RequestInit;
}): Promise<T> => {
  console.log(path, requestInit);
  return await fetch(`${IND_HOST}/${path}`, requestInit).then(
    async (response) => {
      const responseString = await response.text();
      const jsonResult = parseIndResponse(responseString) as IndResponse;

      if (response.status !== 200 || jsonResult.status !== 'OK') {
        throw new Error((jsonResult.error as string) ?? 'Unknown error');
      }

      return jsonResult.data as T;
    },
  );
};

const getDefaultHeaders = async () => {
  return {
    'Content-Type': 'application/json',
    'oap-locale': 'en',
  };
};

export const apiGet = async <T>(
  path: string,
  params: Record<string, string> = {},
) => {
  const response = await axios
    .get(`${IND_HOST}/${path}`, {
      headers: await getDefaultHeaders(),
      params,
    })
    .then((response) => {
      if (response.status !== 200) {
        logError(response.data);
        throw new Error(response.data);
      }

      const data = parseIndResponse(response.data);

      return data.data as T;
    });

  return response;
};

export const apiPost = async <T>(
  path: string,
  data: any,
  params: Record<string, string> = {},
) => {
  const response = await axios
    .post(`${IND_HOST}/${path}`, data, {
      headers: await getDefaultHeaders(),
      params,
    })
    .then((response) => {
      if (response.status !== 200) {
        logError(response.data);
        throw new Error(response.data);
      }

      const data = parseIndResponse(response.data);

      return data.data as T;
    });

  return response;
};

// export const apiPut = async <T>(url: string, data: any) => {
//   const response = await axios.put(url, data, {
//     headers: await getDefaultHeaders(),
//   });
//
//   return response.data;
// };
//
// export const apiDelete = async <T>(url: string) => {
//   const response = await axios.delete(url, {
//     headers: await getDefaultHeaders(),
//   });
//
//   return response.data;
// };
