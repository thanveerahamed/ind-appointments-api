import { apiGet } from '../shared/indFetchClient';
import { Slot } from '../../../types';

export const getSlots = async ({
  persons,
  productType,
  desk,
}: {
  productType: string;
  desk: string;
  persons: string;
}): Promise<Slot[]> => {
  return await apiGet<Slot[]>(`${desk}/slots`, {
    productKey: productType,
    persons,
  });
};
