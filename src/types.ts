export type Category = 'rent' | 'water' | 'electricity' | 'security' | 'sanitation' | 'other';

/**
 * fixed    – same amount every month (rent, umutekano, isuku)
 * variable – amount changes every month; you enter the bill when it arrives (WASAC water)
 * prepaid  – no bill, you buy units/tokens when needed (REG Cash Power)
 */
export type Frequency = 'fixed' | 'variable' | 'prepaid';

export type Method = 'momo' | 'airtel' | 'cash' | 'bank' | 'card' | 'other';

/** Month key in the form YYYY-MM */
export type Period = string;

export interface AmountChange {
  from: Period;
  amount: number;
}

export interface Bill {
  id: string;
  category: Category;
  name: string;
  provider: string;
  frequency: Frequency;
  /** fixed: amount per month · variable: usual amount (estimate) · prepaid: monthly budget */
  amounts: AmountChange[];
  /** Day of month the bill is due (1–31, clamped to month length) */
  dueDay: number;
  /** Who / where to pay, e.g. landlord MoMo number or meter number */
  payTo?: string;
  notes?: string;
  startPeriod: Period;
  /** Last month the bill applies to (set when archived) */
  endPeriod?: Period;
  active: boolean;
}

/** The actual amount billed for a month, for 'variable' bills (e.g. water bill from WASAC). */
export interface Charge {
  id: string;
  billId: string;
  period: Period;
  amount: number;
  /** Meter reading / units consumed (m³ for water) */
  units?: number;
  note?: string;
}

export interface Payment {
  id: string;
  billId: string;
  /** The month this payment is for */
  period: Period;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  method: Method;
  reference?: string;
  note?: string;
  /** Prepaid electricity: kWh bought */
  kwh?: number;
  /** Prepaid electricity: token number */
  token?: string;
}

export interface Settings {
  householdName: string;
  /** Show "due soon" this many days before the due date */
  reminderDays: number;
}

export interface Data {
  version: 1;
  setupDone: boolean;
  bills: Bill[];
  charges: Charge[];
  payments: Payment[];
  settings: Settings;
}
