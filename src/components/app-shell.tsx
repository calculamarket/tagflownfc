import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Tags, QrCode, Link2, BarChart3, Zap, Users,
  Plug, Settings, User, LogOut, Menu, X, Moon, Sun, Shield, Inbox, PackageCheck, Boxes, Calculator, Box, PawPrint, Sparkles, Anchor, Backpack, Mail, Factory, ChevronDown, Bell,
  Wifi, HeartPulse,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { getMyBrand } from "@/lib/tenant.functions";
import { applyBrandTheme } from "@/lib/tenant";
import { unreadNotifications } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";

// Itens principais (gestão das etiquetas).
const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tags", label: "Minhas Tags", icon: Tags },
  { to: "/pecas", label: "Minhas Peças", icon: Boxes },
  { to: "/ativar", label: "Ativar etiqueta", icon: PackageCheck },
  { to: "/qr-codes", label: "QR Codes", icon: QrCode },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
] as const;

const categoryNav = [
  { category: "wifi", label: "Wi-Fi", icon: Wifi },
  { category: "idoso", label: "Idoso — Emergência", icon: HeartPulse },
] as const;

// Geradores de produção (impressão 3D) — agrupados num submenu retrátil.
const generators = [
  { to: "/gerador-3d", label: "Gerador QR 3D", icon: Box },
  { to: "/pet-tag", label: "Pet Tag", icon: PawPrint },
  { to: "/etiqueta-plana", label: "Etiqueta Plana", icon: Tags },
  { to: "/placa-pix", label: "Placa Pix", icon: QrCode },
  { to: "/ganchos", label: "Ganchos", icon: Anchor },
  { to: "/estudio-bonecos", label: "Estúdio de Bonecos", icon: Sparkles },
  { to: "/molde-silicone", label: "Molde de Silicone", icon: Boxes },
  { to: "/qr-kids", label: "QR Kids", icon: Backpack },
  { to: "/criador-envelopes", label: "Criador de Envelopes", icon: Mail },
] as const;

// Ferramentas e configurações.
const secondaryNav = [
  { to: "/calculadora-custos", label: "Calculadora de Custos", icon: Calculator },
  { to: "/links", label: "Links Inteligentes", icon: Link2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leads", label: "Leads", icon: Inbox },
  { to: "/automations", label: "Automações", icon: Zap },
  { to: "/team", label: "Equipe", icon: Users },
  { to: "/integrations", label: "Integrações", icon: Plug },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/account", label: "Minha Conta", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeCategory = useRouterState({
    select: (s) => new URLSearchParams(s.location.searchStr).get("category"),
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string>("");
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { data: brand = BRAND } = useQuery({ queryKey: ["my-brand"], queryFn: () => getMyBrand() });
  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => unreadNotifications(),
    refetchInterval: 60_000,
  });

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
    );

  // Tema white-label: aplica a cor primária do tenant do usuário logado.
  useEffect(() => { applyBrandTheme(brand); }, [brand]);

  // Submenu "Produção 3D": abre sozinho quando você está numa página de gerador.
  const inGen = generators.some((g) => isActive(g.to));
  const [genOpen, setGenOpen] = useState(inGen);
  useEffect(() => { if (inGen) setGenOpen(true); }, [inGen]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? "");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    });
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 lg:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-7 max-w-[140px] object-contain" />
            ) : (
              <>
                <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-[10px] font-bold">
                  {brand.monogram}
                </div>
                {brand.name}
              </>
            )}
          </Link>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const showBadge = item.to === "/notificacoes" && unread > 0;
            return (
              <Link key={item.to} to={item.to} className={linkCls(isActive(item.to))}>
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}

          {categoryNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === "/tags/new" && activeCategory === item.category;
            return (
              <Link
                key={item.category}
                to="/tags/new"
                search={{ category: item.category }}
                className={linkCls(active)}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}

          {/* Submenu retrátil: geradores de produção 3D */}
          <button
            type="button"
            onClick={() => setGenOpen((o) => !o)}
            className={cn(linkCls(inGen && !genOpen), "w-full justify-between")}
          >
            <span className="flex items-center gap-3">
              <Factory className="size-4" />
              Produção 3D
            </span>
            <ChevronDown className={cn("size-4 transition-transform", genOpen && "rotate-180")} />
          </button>
          {genOpen && (
            <div className="ml-4 space-y-1 border-l border-sidebar-border pl-2">
              {generators.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={linkCls(isActive(item.to))}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={linkCls(isActive(item.to))}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mt-4",
                pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Shield className="size-4" />
              Admin
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 text-xs text-sidebar-foreground/60 truncate">{email}</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={toggle}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={handleSignOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 border-b border-border flex items-center px-4 gap-3 bg-background">
          <button onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
          <div className="font-semibold">{brand.name}</div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
