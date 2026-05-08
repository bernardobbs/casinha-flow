import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, TrendingUp, Wallet, Banknote, Target,
  Repeat, CalendarClock, ClipboardList, Fuel, Package, Settings,
  RefreshCw, ListChecks, ShoppingCart, Wrench, Users, Bot,
  BarChart3, AlertTriangle, Zap,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "💰 Financeiro",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Transações", url: "/transactions", icon: Wallet },
      { title: "Conciliação", url: "/conciliacao", icon: RefreshCw },
      { title: "Contas", url: "/contas", icon: Banknote },
      { title: "Orçamento", url: "/budgets", icon: Target },
      { title: "Recorrentes", url: "/recorrentes", icon: Repeat },
      { title: "Contas a Pagar", url: "/contas-a-pagar", icon: CalendarClock },
    ],
  },
  {
    label: "🏠 Casa",
    items: [
      { title: "Estoque", url: "/estoque", icon: Package },
      { title: "Revisão Estoque", url: "/estoque/revisao-semanal", icon: ListChecks },
      { title: "Compras", url: "/compras", icon: ShoppingCart },
      { title: "Manutenção", url: "/manutencao", icon: Wrench },
      { title: "Gasolina", url: "/gasolina", icon: Fuel },
    ],
  },
  {
    label: "📊 Planejamento",
    items: [
      { title: "Situação", url: "/situacao", icon: BarChart3 },
      { title: "Revisão Semanal", url: "/revisao-semanal", icon: ClipboardList },
      { title: "Crise", url: "/crisis", icon: AlertTriangle },
      { title: "Estado Financeiro", url: "/financial-state", icon: TrendingUp },
    ],
  },
  {
    label: "🤖 IA",
    items: [
      { title: "Assistente", url: "/assistente", icon: Bot },
    ],
  },
  {
    label: "⚙️ Sistema",
    items: [
      { title: "Membros", url: "/membros", icon: Users },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const handleNav = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md flex items-center justify-center text-sm"
              style={{ background: "var(--gradient-primary)" }}>
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Casinha Flow</span>
              <span className="text-[10px] text-muted-foreground">controle e liberdade</span>
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = currentPath === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} onClick={handleNav} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
