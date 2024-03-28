import { apiPost } from '../shared/indFetchClient';
import { Slot } from '../../../types';

export const blockSlots = async ({
  desk,
  payload,
  productType,
}: {
  desk: string;
  productType: string;
  payload: Slot;
}): Promise<Slot> => {
  return await apiPost<Slot>(
    `${productType}/${desk}/slots/${payload.key}`,
    payload,
  );
};
