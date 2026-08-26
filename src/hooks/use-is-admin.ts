import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** true quando o usuário logado tem papel de admin (tabela user_roles). */
export function useIsAdmin() {
  const { data } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      return !!roles?.some((r) => r.role === "admin");
    },
    staleTime: 5 * 60_000,
  });
  return data ?? false;
}
