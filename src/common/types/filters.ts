import { Dayjs } from './dayjs';
import { Desk } from './desk';

export interface Filters {
  appointmentType: string;
  locations: Desk[];
  people: string;
  startDate: Dayjs | null;
  endDate: Dayjs | null;
}
