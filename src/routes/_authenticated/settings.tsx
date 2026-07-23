import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Moon, Sun, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações · 3D QR" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (pw.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    if (pw !== pw2) return toast.error("As senhas não coincidem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPw("");
    setPw2("");
    toast.success("Senha atualizada.");
  };

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências e segurança da sua conta.</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-medium">Aparência</h2>
          <p className="text-sm text-muted-foreground">Escolha entre tema claro e escuro.</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Tema {theme === "dark" ? "escuro" : "claro"}</span>
          <Button variant="outline" size="sm" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            Mudar para {theme === "dark" ? "claro" : "escuro"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-medium">Segurança</h2>
          <p className="text-sm text-muted-foreground">Defina uma nova senha de acesso.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Nova senha</Label>
            <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirmar senha</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <Button onClick={changePassword} disabled={saving || !pw || !pw2}>
          {saving ? "Salvando…" : "Atualizar senha"}
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-medium">Sessão</h2>
          <p className="text-sm text-muted-foreground">
            Encerra a sessão em todos os dispositivos onde você está conectado.
          </p>
        </div>
        <Button variant="outline" onClick={signOutEverywhere}>
          <LogOut className="size-4" /> Sair de todos os dispositivos
        </Button>
      </section>
    </div>
  );
}
