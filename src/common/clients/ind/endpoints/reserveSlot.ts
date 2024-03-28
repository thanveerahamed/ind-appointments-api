import { apiPost } from '../shared/indFetchClient';
import { BookAppointmentResponse } from '../../../types';

export const reserveSlot = async ({
  desk,
  payload,
}: {
  desk: string;
  payload: any;
}): Promise<BookAppointmentResponse> => {
  return await apiPost<BookAppointmentResponse>(
    `${desk}/appointments`,
    payload,
  );
};
