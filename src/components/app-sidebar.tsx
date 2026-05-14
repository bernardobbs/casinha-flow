import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Wallet, Banknote, Target, Repeat,
  CalendarClock, Package, Wrench, Users, Bot,
  BarChart3, AlertTriangle, Zap, ShoppingCart,
  ListChecks, RefreshCw, ClipboardList, Fuel, TrendingUp, FileText,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const APP_NAME = "Casinha Hub";
const APP_TAGLINE = "O centro de controle da sua casa";

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
      { title: "A Pagar", url: "/contas-a-pagar", icon: CalendarClock },
    ],
  },
  {
    label: "🏠 Casa",
    items: [
      { title: "Compras", url: "/compras", icon: ShoppingCart },
      { title: "Estoque", url: "/estoque", icon: Package },
      { title: "Revisão Estoque", url: "/estoque/revisao-semanal", icon: ListChecks },
      { title: "Manutenção", url: "/manutencao", icon: Wrench },
      { title: "Combustível", url: "/gasolina", icon: Fuel },
    ],
  },
  {
    label: "📊 Planejamento",
    items: [
      { title: "Revisão Semanal", url: "/revisao-semanal", icon: ClipboardList },
      { title: "Situação Financeira", url: "/situacao", icon: BarChart3 },
      { title: "Relatórios", url: "/relatorios", icon: FileText },
    ],
  },
  {
    label: "🤖 Inteligência",
    items: [
      { title: "Assistente", url: "/assistente", icon: Bot },
    ],
  },
  {
    label: "⚙️ Sistema",
    items: [
      { title: "Membros", url: "/membros", icon: Users },
      { title: "Configurações", url: "/configuracoes", icon: Zap },
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
            <div className="h-7 w-7 rounded-md flex items-center justify-center text-sm shrink-0"
              style={{ background: "var(--gradient-primary)" }}>
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
              <span className="text-[10px] text-muted-foreground truncate">{APP_TAGLINE}</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <div className="h-7 w-7 rounded-md flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}>
              <Zap className="h-4 w-4 text-primary-foreground" />
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
