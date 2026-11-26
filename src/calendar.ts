import { addDays, amountFor, categoryInfo, categoryLabel, dueDate, formatRWF, isLogBill, periodOf, todayStr, addMonths, billName } from './logic';
import { t } from './i18n';
import type { Bill, Data } from './types';

export interface CalEvent {
  uid: string;
  title: string;
  description: string;
  /** YYYY-MM-DD, all-day */
  date: string;
  /** RRULE body without the "RRULE:" prefix */
  rrule?: string;
  /** Remind this many days before (and on the day) */
  remindDays: number;
}

const compact = (d: string) => d.replace(/-/g, '');

function monthlyRule(day: number): string {
  // Days 29–31 don't exist in every month – use the month's last day instead.
  return day > 28 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : `FREQ=MONTHLY;BYMONTHDAY=${day}`;
}

/** The next due date on or after today for a monthly bill. */
function nextDue(bill: Bill, today: string): string {
  const p = periodOf(today);
  const d = dueDate(bill, p);
  return d >= today ? d : dueDate(bill, addMonths(p, 1));
}

export function billEvent(bill: Bill, data: Data, today = todayStr()): CalEvent | null {
  if (isLogBill(bill) || !bill.active) return null;
  const amount = amountFor(bill, periodOf(today));
  const info = categoryInfo(bill.category);
  return {
    uid: `bill-${bill.id}@fagitire`,
    title: `${info.icon} ${t('{name} due', { name: billName(bill) })}${amount ? ` – ${formatRWF(amount)}` : ''}`,
    description: [categoryLabel(bill.category), bill.provider, bill.payTo].filter(Boolean).join(' · '),
    date: nextDue(bill.dueDay > 28 ? { ...bill, dueDay: 31 } : bill, today),
    rrule: monthlyRule(bill.dueDay),
    remindDays: data.settings.reminderDays,
  };
}

/** All reminders: monthly bills, lease dates and savings-goal deadlines. */
export function allEvents(data: Data, today = todayStr()): CalEvent[] {
  const out: CalEvent[] = [];
  for (const b of data.bills) {
    const e = billEvent(b, data, today);
    if (e) out.push(e);
    const l = b.lease;
    if (b.active && l?.end && l.end >= today) {
      out.push({ uid: `lease-end-${b.id}@fagitire`, title: `🏠 ${t('Lease ends')} – ${billName(b)}`, description: [l.landlordName, l.landlordPhone].filter(Boolean).join(' · '), date: l.end, remindDays: 60 });
    }
    if (b.active && l?.nextIncrease && l.nextIncrease >= today) {
      out.push({ uid: `lease-increase-${b.id}@fagitire`, title: `🏠 ${t('Rent increase')} – ${billName(b)}`, description: l.increaseNote ?? '', date: l.nextIncrease, remindDays: 30 });
    }
  }
  for (const g of data.goals) {
    if (g.archived || !g.deadline || g.deadline < periodOf(today)) continue;
    out.push({ uid: `goal-${g.id}@fagitire`, title: `🎯 ${t('Savings goal')}: ${g.name} – ${formatRWF(g.target)}`, description: '', date: `${g.deadline}-01`, remindDays: 30 });
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Folds lines longer than 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function toIcs(events: CalEvent[], now = new Date()): string {
  const stampStr = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fagitire//Household bills//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stampStr}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    // All-day events start at midnight: remind at 09:00 on the day, and at 09:00 N days before.
    const triggers = ['PT9H'];
    if (e.remindDays > 0) triggers.push(`-P${e.remindDays - 1}DT15H`);
    for (const trigger of triggers) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A link that opens Google Calendar with the event filled in (handy on Android). */
export function googleCalendarUrl(e: CalEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(e.date)}/${compact(addDays(e.date, 1))}`,
    details: e.description,
  });
  if (e.rrule) params.set('recur', `RRULE:${e.rrule}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
