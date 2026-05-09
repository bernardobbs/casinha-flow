import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { QuickAddButton } from "@/components/QuickAddButton";
import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import { RecurringAutoGen } from "@/components/RecurringAutoGen";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const noChrome = path === "/" || path === "/auth" || path.startsWith("/auth");

  if (noChrome) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
        </div>
        <main className="flex-1">
          <Outlet />
        </main>
        <QuickAddButton />
        <InstallPwaBanner />
        <RecurringAutoGen />
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
