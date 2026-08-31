import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FILAMENT_TYPES, MATERIAL_PROFILES, type FilamentType, type MaterialSlot } from "@/lib/three-mf";

/** Short temperature hint shown under the material selector. */
function TempHint({ material }: { material: FilamentType }) {
  const p = MATERIAL_PROFILES[material];
  return (
    <p className="text-xs text-muted-foreground">
      Bico {p.nozzleMin}–{p.nozzleMax}°C · mesa {p.bed}°C
    </p>
  );
}

type Props = {
  label: string;
  idPrefix: string;
  value: MaterialSlot;
  onChange: (slot: MaterialSlot) => void;
  /** How many extruder / AMS slots the printer has. */
  slots: number;
};

/** Slot + material + colour picker for one object of the 3MF. */
export function MaterialSlotFields({ label, idPrefix, value, onChange, slots }: Props) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>{label} · slot</Label>
        <Select
          value={String(value.extruder)}
          onValueChange={(v) => onChange({ ...value, extruder: Number(v) })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: slots }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                Slot {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{label} · material</Label>
        <Select
          value={value.material}
          onValueChange={(v) => onChange({ ...value, material: v as FilamentType })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILAMENT_TYPES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TempHint material={value.material} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cor`}>{label} · cor</Label>
        <input
          id={`${idPrefix}-cor`}
          type="color"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background"
        />
      </div>
    </>
  );
}

type CountProps = { value: number; onChange: (n: number) => void };

/** Printer slot count selector (1–8). */
export function SlotCountField({ value, onChange }: CountProps) {
  return (
    <div className="space-y-1.5">
      <Label>Cores da impressora</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <SelectItem key={n} value={String(n)}>{n} cor{n > 1 ? "es" : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type PaletteProps = {
  /** One entry per printer slot (index 0 = slot 1). */
  value: MaterialSlot[];
  onChange: (slots: MaterialSlot[]) => void;
};

/** Printer palette: define material + colour once per AMS slot. */
export function SlotPalette({ value, onChange }: PaletteProps) {
  const setCount = (n: number) => {
    const next = Array.from({ length: n }, (_, i) =>
      value[i] ?? { extruder: i + 1, material: "PLA" as FilamentType, color: i === 0 ? "#ffffff" : "#111111" },
    );
    onChange(next.map((s, i) => ({ ...s, extruder: i + 1 })));
  };
  const patch = (i: number, part: Partial<MaterialSlot>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...part } : s)));

  return (
    <div className="space-y-3">
      <div className="max-w-[220px]">
        <SlotCountField value={value.length} onChange={setCount} />
      </div>
      <div className="space-y-2">
        {value.map((slot, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border border-border p-2">
            <span className="w-16 text-sm font-medium">Slot {i + 1}</span>
            <input
              aria-label={`Cor do slot ${i + 1}`}
              type="color"
              value={slot.color}
              onChange={(e) => patch(i, { color: e.target.value })}
              className="h-8 w-12 shrink-0 rounded-md border border-input bg-background"
            />
            <Select value={slot.material} onValueChange={(v) => patch(i, { material: v as FilamentType })}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILAMENT_TYPES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {slot.color.toUpperCase()} · bico {MATERIAL_PROFILES[slot.material].nozzleMin}–
              {MATERIAL_PROFILES[slot.material].nozzleMax}°C
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type PartProps = {
  label: string;
  palette: MaterialSlot[];
  value: number;
  onChange: (extruder: number) => void;
};

/** Assign one part of the model to a palette slot; shows the resulting colour. */
export function PartSlotPicker({ label, palette, value, onChange }: PartProps) {
  const slot = palette[Math.min(palette.length, Math.max(1, value)) - 1];
  return (
    <div className="flex items-center gap-3">
      <Label className="w-28 shrink-0">{label}</Label>
      <span
        aria-hidden
        className="size-6 shrink-0 rounded-md border border-input"
        style={{ background: slot?.color ?? "#ffffff" }}
      />
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {palette.map((s, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              Slot {i + 1} · {s.material} · {s.color.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
