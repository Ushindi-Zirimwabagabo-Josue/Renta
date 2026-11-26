export type Category =
  | 'rent'
  | 'water'
  | 'electricity'
  | 'security'
  | 'sanitation'
  | 'internet'
  | 'tv'
  | 'gas'
  | 'airtime'
  | 'househelp'
  | 'contributions'
  | 'other';

/**
 * fixed      – same amount every month (rent, umutekano, isuku, internet, TV, salary)
 * variable   – amount changes every month; you enter the bill when it arrives (WASAC water)
 * prepaid    – no bill, you top up when needed (Cash Power, gas, airtime) against a monthly budget
 * occasional – irregular contributions (tithe, weddings, funerals) – just recorded
 */
export type Frequency = 'fixed' | 'variable' | 'prepaid' | 'occasional';

export type Method = 'momo' | 'airtel' | 'cash' | 'bank' | 'card' | 'other';

export type Lang = 'en' | 'rw' | 'fr';

/** Month key in the form YYYY-MM */
export type Period = string;

/** Every stored record carries the time it was last changed, used to merge synced copies. */
export interface Stamped {
  id: string;
  updatedAt?: number;
}

export interface AmountChange {
  from: Period;
  amount: number;
}

export interface Lease {
  start?: string;
  end?: string;
  deposit?: number;
  landlordName?: string;
  landlordPhone?: string;
  /** Date the next rent increase takes effect (YYYY-MM-DD) */
  nextIncrease?: string;
  increaseNote?: string;
}

export interface Bill extends Stamped {
  category: Category;
  name: string;
  provider: string;
  frequency: Frequency;
  /** fixed: amount per month · variable: usual amount (estimate) · prepaid/occasional: monthly budget */
  amounts: AmountChange[];
  /** Day of month the bill is due (1–31, clamped to month length). For TV this is the renewal day. */
  dueDay: number;
  payTo?: string;
  notes?: string;
  startPeriod: Period;
  endPeriod?: Period;
  active: boolean;
  /** Rent bills only */
  lease?: Lease;
}

/** The actual amount billed for a month, for 'variable' bills (e.g. water bill from WASAC). */
export interface Charge extends Stamped {
  billId: string;
  period: Period;
  amount: number;
  units?: number;
  note?: string;
  photoIds?: string[];
}

export interface Payment extends Stamped {
  billId: string;
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
  /** House help: paid before the end of the month, deducted from the salary */
  isAdvance?: boolean;
  photoIds?: string[];
}

/**
 * A meter reading.
 * Water: the cumulative m³ shown on the meter.
 * Electricity: the kWh units remaining on the Cash Power meter.
 */
export interface Reading extends Stamped {
  billId: string;
  /** YYYY-MM-DD */
  date: string;
  value: number;
  note?: string;
}

export interface IncomeSource extends Stamped {
  name: string;
  /** Expected amount per month */
  amount: number;
  payDay: number;
  active: boolean;
}

export interface Income extends Stamped {
  sourceId?: string;
  /** Free text when not linked to a source */
  label: string;
  amount: number;
  date: string;
  period: Period;
  note?: string;
}

export interface GoalDeposit {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Goal extends Stamped {
  name: string;
  target: number;
  /** Target month YYYY-MM */
  deadline?: Period;
  deposits: GoalDeposit[];
  archived?: boolean;
}

export interface TariffBlock {
  /** Upper bound of the block in kWh per month; null = no limit */
  upTo: number | null;
  /** RWF per kWh before VAT */
  price: number;
}

export interface LockSettings {
  pinHash: string;
  salt: string;
  pinLength: number;
  /** WebAuthn credential id (base64url) for fingerprint / face unlock */
  credentialId?: string;
}

export interface Settings {
  householdName: string;
  reminderDays: number;
  language: Lang;
  /** Monthly budget per category (RWF). Missing = no budget. */
  budgets: Partial<Record<Category, number>>;
  /** Overall monthly budget across everything */
  totalBudget?: number;
  tariff: { blocks: TariffBlock[]; vatPct: number };
  lock?: LockSettings;
  /** Lock again after the app has been in the background this many minutes */
  lockAfterMinutes: number;
  googleClientId?: string;
  updatedAt?: number;
}

export interface Data {
  version: 2;
  setupDone: boolean;
  bills: Bill[];
  charges: Charge[];
  payments: Payment[];
  readings: Reading[];
  incomeSources: IncomeSource[];
  incomes: Income[];
  goals: Goal[];
  settings: Settings;
  /** id → time deleted; lets a sync remove records deleted on another device */
  deleted: Record<string, number>;
}

export type Collection = 'bills' | 'charges' | 'payments' | 'readings' | 'incomeSources' | 'incomes' | 'goals';
export const COLLECTIONS: Collection[] = ['bills', 'charges', 'payments', 'readings', 'incomeSources', 'incomes', 'goals'];
