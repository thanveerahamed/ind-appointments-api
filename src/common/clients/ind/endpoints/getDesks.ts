import { AppointmentType } from '../../../types';
import { Desk } from '../../../types';
import { apiGet } from '../shared/indFetchClient';

export const getDesks = async (
  appointmentType: AppointmentType,
): Promise<Desk[]> => {
  return await apiGet<Desk[]>('', {
    productKey: appointmentType,
  });
};
