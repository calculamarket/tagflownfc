import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "tag-assets";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload a file to the `tag-assets` bucket (stored under <user_id>/…) and hand
 * back its public URL. Pasting a URL directly still works, so existing links
 * and externally hosted assets keep functioning.
 */
export function FileUpload({
  value,
  onChange,
  accept = "image/*",
  placeholder = "https://…",
  preview = "image",
}: {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  placeholder?: string;
  preview?: "image" | "file" | "none";
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 10 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada. Entre novamente.");

      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Arquivo enviado.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isPdf = /\.pdf($|\?)/i.test(value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          title="Enviar arquivo"
        >
          <Upload className="size-4" />
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} title="Remover">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />

      {busy && <p className="text-xs text-muted-foreground">Enviando…</p>}

      {!busy && value && preview === "image" && !isPdf && (
        <img
          src={value}
          alt=""
          className="h-16 w-16 rounded-md border border-border object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      {!busy && value && (preview === "file" || isPdf) && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
        >
          <FileText className="size-3.5" /> Abrir arquivo
        </a>
      )}
    </div>
  );
}
