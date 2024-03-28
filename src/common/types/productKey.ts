export enum AppointmentType {
  BIO = 'BIO',
  DOC = 'DOC',
  VAA = 'VAA',
  TKV = 'TKV',
}

export const AppointmentTypeLabel: Record<AppointmentType, string> = {
  [AppointmentType.BIO]: 'Biometric',
  [AppointmentType.DOC]: 'Document collection',
  [AppointmentType.VAA]: 'Endorsement sticker',
  [AppointmentType.TKV]: 'Return visa',
};
