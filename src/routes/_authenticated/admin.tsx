import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · TagFlow" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalReads, setTotalReads] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { count }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
        supabase.from("reads").select("id", { count: "exact", head: true }),
      ]);
      setUsers(profiles ?? []);
      setTotalReads(count ?? 0);
    })();
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Gestão da plataforma.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Usuários</div>
          <div className="text-3xl font-semibold mt-2">{users.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Leituras totais</div>
          <div className="text-3xl font-semibold mt-2">{totalReads}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Receita</div>
          <div className="text-3xl font-semibold mt-2">R$ 0</div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="p-5 border-b border-border font-semibold">Usuários</div>
        <div className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="px-5 py-3 text-sm flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
