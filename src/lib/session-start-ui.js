// Presentation guard only: no stored times, attendance rules or session mutations.
export function isBeforeScheduledStart(session, now = new Date()) {
  if (!session?.date || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(session.startTime ?? ''))) return false;
  const [hour, minute] = session.startTime.split(':');
  const start = new Date(`${session.date}T${hour.padStart(2, '0')}:${minute}:00`);
  return Number.isFinite(start.getTime()) && now.getTime() < start.getTime();
}
