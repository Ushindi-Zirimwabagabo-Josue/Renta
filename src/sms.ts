import { todayStr } from './logic';
import type { Bill, Method } from './types';

export interface ParsedSms {
  amount?: number;
  date?: string;
  reference?: string;
  recipient?: string;
  token?: string;
  kwh?: number;
  method?: Method;
  /** Best matching bill, if any */
  billId?: string;
}

const MONEY = /(?:(?:RWF|FRW|Frw|Rwf)\s*([\d][\d,. ]*\d|\d))|(?:([\d][\d,. ]*\d|\d)\s*(?:RWF|FRW|Frw|Rwf))/g;
const SKIP_CONTEXT = /(fee|balance|solde|frais|charge|commission|amafaranga asigaye|asigaye|tax)\W*$/i;

function toNumber(s: string): number {
  // "10,000" / "10 000" / "10.000" are thousands; "10000.00" has decimals.
  const clean = s.replace(/\s/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(clean)) return Number(clean.replace(/[.,]/g, ''));
  return Number(clean.replace(/,/g, ''));
}

function parseDate(text: string): string | undefined {
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/**
 * Reads a mobile-money confirmation SMS (MTN MoMo, Airtel Money) or a REG Cash Power
 * token message and extracts what it can. Formats vary, so everything is a best guess
 * that the user confirms in the payment form.
 */
export function parseSms(text: string, bills: Bill[] = []): ParsedSms {
  const out: ParsedSms = {};
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return out;

  // Amount: first money value that isn't a fee or a balance.
  for (const m of flat.matchAll(MONEY)) {
    const before = flat.slice(Math.max(0, (m.index ?? 0) - 30), m.index);
    if (SKIP_CONTEXT.test(before)) continue;
    const n = toNumber(m[1] ?? m[2]);
    if (n > 0) {
      out.amount = n;
      break;
    }
  }

  out.date = parseDate(flat);

  const ref = flat.match(/(?:Financial Transaction Id|Transaction Id|Trans(?:action)?\.? ?ID|TxId|Txn ?Id|Ref(?:erence)?(?: ?(?:no|number))?|ID)\s*[:#.]?\s*([A-Z0-9][A-Z0-9.\-]{4,})/i);
  if (ref) out.reference = ref[1].replace(/[.]$/, '');

  const token = flat.match(/(?:token|tokeni)\s*(?:no|number)?\s*[:#]?\s*((?:\d[\s-]?){19}\d)/i) ?? flat.match(/\b((?:\d{4}[\s-]){4}\d{4})\b/);
  if (token) out.token = token[1].replace(/[^\d]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

  const kwh = flat.match(/(\d+(?:[.,]\d+)?)\s*kwh/i) ?? flat.match(/units?\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (kwh) out.kwh = Number(kwh[1].replace(',', '.'));

  const to = flat.match(/\b(?:to|kuri|à|a|paid to|payment to)\s+([A-Za-z][A-Za-z0-9 &'.\-]{1,40}?)(?=\s*\(|\s+(?:at|on|with|ku|le|was|has|on)\b|[,.;]|\s+\d)/);
  if (to) out.recipient = to[1].trim();

  if (/airtel/i.test(flat)) out.method = 'airtel';
  else if (/momo|mtn|mobile money|\*16[0-9]\*/i.test(flat)) out.method = 'momo';
  else out.method = 'momo';

  out.billId = guessBill(flat, out, bills);
  return out;
}

function guessBill(flat: string, p: ParsedSms, bills: Bill[]): string | undefined {
  const active = bills.filter((b) => b.active);
  const lower = flat.toLowerCase();
  const byCat = (c: Bill['category']) => active.find((b) => b.category === c)?.id;
  if (p.token || p.kwh || /cash ?power|\breg\b|eucl|electricity|amashanyarazi/i.test(flat)) return byCat('electricity');
  if (/wasac|water|amazi/i.test(flat)) return byCat('water');
  if (/canal|startimes|dstv/i.test(flat)) return byCat('tv');
  if (/airtime|bundle|data pack|internet pack/i.test(flat)) return byCat('airtime');
  // Match the recipient or pay-to details against the user's bills.
  for (const b of active) {
    const needles = [b.payTo, b.provider, b.name].filter((x): x is string => !!x && x.trim().length >= 3);
    for (const n of needles) {
      const digits = n.replace(/\D/g, '');
      if (digits.length >= 9 && lower.replace(/\D/g, '').includes(digits.slice(-9))) return b.id;
      if (lower.includes(n.toLowerCase())) return b.id;
    }
  }
  return undefined;
}

export const smsDateOrToday = (p: ParsedSms) => p.date ?? todayStr();
