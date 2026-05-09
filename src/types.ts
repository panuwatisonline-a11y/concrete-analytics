export interface ConcreteRecord {
  ID: string;
  'Casting date': string;
  Month: string;
  'Current Status': string;
  'Request by': string;
  'Concrete Works': string;
  Structure: string;
  Location: string;
  'Structure No. or Grid Line': string;
  Supplier: string;
  'Mix code': string;
  Slump: string;
  Strength: string;
  'DWG. Volume': string;
  'Actual Volume': string;
  'Confirm Volume': string;
  'Loss Concrete': string | null;
  'Request Volume': string;
  'Amount of Sample': string;
  Client: string;
  Timestamp: number;
  [key: string]: string | number | null | undefined;
}

export interface Filters {
  status: string | null;
  supplier: string | null;
  structure: string | null;
  staff: string | null;
  strength: string | null;
}
