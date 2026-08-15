import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FILAMENT_TYPES, type FilamentType, type MaterialSlot } from "@/lib/three-mf";

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
