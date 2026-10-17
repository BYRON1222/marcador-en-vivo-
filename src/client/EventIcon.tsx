export const EVENT_META: Record<string, { label: string; color: string }> = {
  goal: { label: "Gol", color: "#16a34a" },
  foul: { label: "Falta", color: "#ea580c" },
  substitution: { label: "Cambio", color: "#2563eb" },
  yellow_card: { label: "Tarjeta amarilla", color: "#ca8a04" },
  red_card: { label: "Tarjeta roja", color: "#dc2626" },
};

export function EventIcon({ type }: { type: string }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (type) {
    case "goal": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8l3 2-1 3.5h-4L9 10z" fill="currentColor" /></svg>;
    case "foul": return <svg {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17v.5" /></svg>;
    case "substitution": return <svg {...p}><path d="M4 8h14l-3-3M20 16H6l3 3" /></svg>;
    case "yellow_card": return <svg {...p}><rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" /></svg>;
    case "red_card": return <svg {...p}><rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" /></svg>;
    default: return null;
  }
}
