/** Business-day helpers. Vercel runs in UTC; Malesan's owner and users are WIB. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function jakartaDayKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function startOfJakartaDay(value: Date | string | number = new Date()): Date {
  const [year, month, day] = jakartaDayKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}

export function lastJakartaDays(count: number, now: Date = new Date()): string[] {
  const today = startOfJakartaDay(now).getTime();
  return Array.from({ length: count }, (_, index) =>
    jakartaDayKey(today - (count - 1 - index) * 86_400_000),
  );
}
