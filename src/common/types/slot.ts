export interface Slot {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  parts: number;
}

export interface Person {
  vNumber: string;
  bsn: string;
  firstName: string;
  lastName: string;
}

export interface ResponsePerson extends Person {
  vnumber: string;
  fullName: string;
}

export interface BookAppointmentResponse extends Omit<Slot, 'parts'> {
  version: number;
  code: string;
  productKey: string;
  email: string;
  hasEmail: boolean;
  phone: string;
  language: string;
  status?: any;
  hasDetail: boolean;
  customers: ResponsePerson[];
  birthDate?: any;
  user?: any;
}
