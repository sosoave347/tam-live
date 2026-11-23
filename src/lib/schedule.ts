import tables from "@/data/schedules.json";

type DayKind = "wd" | "sa" | "su";
type Tables = Record<string, Record<string, Partial<Record<DayKind, number[]>>>>;

const schedules = tables as Tables;

export function scheduledWait(routeId: string, direction: number, offsetSeconds: number, readySeconds: number) {
  const ready = new Date(readySeconds * 1000);
  const times = schedules[routeId]?.[String(direction)]?.[dayKind(ready)];
  if (!times?.length) return null;
  const minute = ready.getHours() * 60 + ready.getMinutes();
  const offset = Math.round(offsetSeconds / 60);
  for (const start of times) {
    const atStop = start + offset;
    if (atStop >= minute - 1) {
      const wait = Math.max(0, atStop - minute);
      return wait <= 180 ? wait : null;
    }
  }
  return null;
}

export function clockFrom(readySeconds: number, waitMin: number) {
  const date = new Date((readySeconds + waitMin * 60) * 1000);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dayKind(when: Date): DayKind {
  const day = when.getDay();
  if (day === 0) return "su";
  if (day === 6) return "sa";
  return "wd";
}
