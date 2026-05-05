import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, TrendingUp, Wallet, Banknote, Target,
  Repeat, CalendarClock, ClipboardList, Fuel, Package, Settings,
  RefreshCw, ListChecks,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, emoji: "📊" },
  { title: "Situação", url: "/situacao", icon: TrendingUp, emoji: "📈" },
  { title: "Transações", url: "/transactions", icon: Wallet, emoji: "💳" },
  { title: "Conciliação", url: "/conciliacao", icon: RefreshCw, emoji: "🔄" },
  { title: "Contas", url: "/contas", icon: Banknote, emoji: "🏦" },
  { title: "Orçamento", url: "/budgets", icon: Target, emoji: "📋" },
  { title: "Recorrentes", url: "/recorrentes", icon: Repeat, emoji: "🔄" },
  { title: "Contas a Pagar", url: "/contas-a-pagar", icon: CalendarClock, emoji: "📅" },
  { title: "Revisão Semanal", url: "/revisao-semanal", icon: ClipboardList, emoji: "📋" },
  { title: "Gasolina", url: "/gasolina", icon: Fuel, emoji: "⛽" },
  { title: "Estoque", url: "/estoque", icon: Package, emoji: "📦" },
  { title: "Revisão Estoque", url: "/estoque/revisao-semanal", icon: ListChecks, emoji: "📦" },
  { title: "Configurações", url: "/configuracoes", icon: Settings, emoji: "⚙️" },
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
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Casinha Flow</span>
            <span className="text-[10px] text-muted-foreground">controle e liberdade</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} onClick={handleNav} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.emoji} {item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
