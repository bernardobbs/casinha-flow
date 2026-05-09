import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "casinha:pwa-dismissed-until";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwaBanner() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(ua);
    if (!isMobile) return;

    // Já instalado?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Dismissed recentemente?
    const until = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (until && Date.now() < until) return;

    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (ios) {
      // iOS não dispara beforeinstallprompt — mostra instrução
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(Date.now() + sevenDays));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden">
      <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur shadow-lg p-3 flex items-start gap-3">
        <div className="text-2xl shrink-0">📱</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            Instale o Casinha Hub na tela inicial
          </p>
          {isIos ? (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
              Toque em <Share className="h-3 w-3 inline" /> Compartilhar → Adicionar à Tela de Início
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Acesso rápido sem abrir o navegador.
            </p>
          )}
          {!isIos && deferred && (
            <Button size="sm" onClick={install} className="mt-2 h-7 gap-1">
              <Download className="h-3 w-3" />
              Instalar
            </Button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
