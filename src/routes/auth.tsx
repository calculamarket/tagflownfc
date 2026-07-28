import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { BRAND, pageTitle } from "@/lib/brand";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  // Where to go after auth. Restricted to internal paths so it can't be turned
  // into an open redirect via a crafted link.
  redirect: z.string().optional(),
});

function safeRedirect(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: pageTitle("Entrar") }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, redirect } = Route.useSearch();
  const dest = safeRedirect(redirect);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest, replace: true });
    });
  }, [navigate, dest]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: dest, replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-[10px] font-bold">{BRAND.monogram}</div>
          {BRAND.name}
        </Link>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">
            Uma plataforma. Todas as suas etiquetas.
          </h2>
          <p className="mt-3 text-sm text-sidebar-foreground/70 max-w-md">
            Gestão profissional de NFC, QR Codes e links inteligentes com analytics em tempo real.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} {BRAND.name}</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-8 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Voltar
          </Link>
          <h1 className="text-2xl font-semibold">
            {mode === "signin" && "Entrar na sua conta"}
            {mode === "signup" && "Criar conta"}
            {mode === "reset" && "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" && "Bem-vindo de volta."}
            {mode === "signup" && "Comece grátis em segundos."}
            {mode === "reset" && "Enviaremos um link para o seu e-mail."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-muted-foreground space-y-1.5">
            {mode === "signin" && (
              <>
                <div>
                  <button onClick={() => setMode("reset")} className="hover:text-foreground">Esqueci minha senha</button>
                </div>
                <div>
                  Ainda não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline">Criar</button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div>
                Já tem conta?{" "}
                <button onClick={() => setMode("signin")} className="text-primary hover:underline">Entrar</button>
              </div>
            )}
            {mode === "reset" && (
              <button onClick={() => setMode("signin")} className="hover:text-foreground">Voltar ao login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
