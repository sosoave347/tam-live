import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";

export function nextQuarter(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.min(23 * 60 + 45, Math.ceil((minutes + 1) / 15) * 15);
}

export function departInstant(dayOffset: number, clock: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setMinutes(clock);
  return date;
}

export function DepartWhen({
  planned,
  dayOffset,
  clock,
  onPlanned,
  onDay,
  onClock,
}: {
  planned: boolean;
  dayOffset: number;
  clock: number;
  onPlanned: (planned: boolean) => void;
  onDay: (offset: number) => void;
  onClock: (clock: number) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <Pressable onPress={() => onPlanned(false)} style={[styles.item, !planned && styles.on]}>
          <Text style={[styles.text, !planned && styles.textOn]}>Maintenant</Text>
        </Pressable>
        <Pressable onPress={() => onPlanned(true)} style={[styles.item, planned && styles.on]}>
          <Text style={[styles.text, planned && styles.textOn]}>{planned ? `${dayLabel(dayOffset)} ${formatClock(clock)}` : "Heure"}</Text>
        </Pressable>
      </View>
      {planned ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
              <Pressable key={offset} onPress={() => onDay(offset)} style={[styles.day, dayOffset === offset && styles.on]}>
                <Text style={[styles.text, dayOffset === offset && styles.textOn]}>{dayLabel(offset)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.clockRow}>
            <Pressable style={styles.step} onPress={() => onClock(Math.max(5 * 60, clock - 15))}>
              <Text style={styles.stepText}>–</Text>
            </Pressable>
            <Text style={styles.clock}>{formatClock(clock)}</Text>
            <Pressable style={styles.step} onPress={() => onClock(Math.min(23 * 60 + 45, clock + 15))}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function dayLabel(offset: number) {
  if (offset === 0) return "Auj.";
  if (offset === 1) return "Dem.";
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."][date.getDay()];
}

function formatClock(total: number) {
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    segment: { flexDirection: "row", backgroundColor: palette.fill, borderRadius: 12, padding: 3, gap: 3 },
    item: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
    day: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.fill },
    on: { backgroundColor: palette.panelSolid },
    text: { color: palette.muted, fontSize: 13, fontWeight: "600" },
    textOn: { color: palette.text },
    days: { gap: 6 },
    clockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    step: {
      width: 44,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.fill,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: { color: palette.text, fontSize: 20, fontWeight: "600" },
    clock: { color: palette.text, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  });
}
