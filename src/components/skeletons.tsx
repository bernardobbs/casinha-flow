import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ── SKELETON GENÉRICO ─────────────────────────────────────────
export function SkeletonPage() {
  return (
    <div className="min-h-screen p-4 space-y-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <SkeletonCards count={3} />
        <SkeletonList count={5} />
      </div>
    </div>
  );
}

// ── CARDS RESUMO ──────────────────────────────────────────────
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${Math.min(count, 3)} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="py-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── LISTA DE ITENS ────────────────────────────────────────────
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
export function SkeletonDashboard() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <Card>
          <CardContent className="py-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-24 w-24 rounded-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent className="py-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </CardContent></Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
          <CardContent className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
          <CardContent className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── TRANSAÇÕES ────────────────────────────────────────────────
export function SkeletonTransactions() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3">
        <Skeleton className="h-5 w-32 mx-auto" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2 justify-center">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-32 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="py-3 space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </CardContent></Card>
          ))}
        </div>
        {[1,2].map(group => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            {[1,2,3].map(i => (
              <Card key={i}><CardContent className="py-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16" />
              </CardContent></Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ORÇAMENTO ─────────────────────────────────────────────────
export function SkeletonBudgets() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex gap-2">
        <Skeleton className="h-8 w-16 rounded" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="py-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </CardContent></Card>
          ))}
        </div>
        {[1,2,3].map(grupo => (
          <div key={grupo} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="pl-2 border-l-2 border-muted space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-12 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-24 rounded" />
                      <Skeleton className="h-7 w-7 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CONTAS ────────────────────────────────────────────────────
export function SkeletonContas() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        <Card><CardContent className="py-4 flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
        </CardContent></Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map(i => (
            <Card key={i}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-7 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1 rounded" />
                  <Skeleton className="h-8 flex-1 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CONTAS A PAGAR ────────────────────────────────────────────
export function SkeletonContasAPagar() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="h-9 w-20 rounded" />
      </div>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Card><CardContent className="py-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            {[1,2,3].map(i => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent></Card>
        {[1,2].map(s => (
          <Card key={s}>
            <CardHeader><div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div></CardHeader>
            <CardContent className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-28 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── ESTOQUE ───────────────────────────────────────────────────
export function SkeletonEstoque() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent className="py-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-8" />
            </CardContent></Card>
          ))}
        </div>
        <div className="flex gap-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-20 rounded" />)}
        </div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <Card key={i}><CardContent className="py-3 flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-16 rounded" />
                <Skeleton className="h-7 w-16 rounded" />
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── REVISÃO ESTOQUE ───────────────────────────────────────────
export function SkeletonRevisaoEstoque() {
  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent className="py-3 space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-8" />
            </CardContent></Card>
          ))}
        </div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <Card key={i}><CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-1.5">
                {[1,2,3,4,5].map(j => <Skeleton key={j} className="h-7 w-12 rounded" />)}
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RECORRENTES ───────────────────────────────────────────────
export function SkeletonRecorrentes() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28 rounded" />
      </div>
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        <Card><CardHeader className="pb-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader></Card>
        {[1,2,3,4].map(i => (
          <Card key={i}><CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ── GASOLINA ──────────────────────────────────────────────────
export function SkeletonGasolina() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28 rounded" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1,2].map(i => (
            <Card key={i}><CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1,2,3,4].map(j => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent></Card>
          ))}
        </div>
        <SkeletonList count={4} />
      </div>
    </div>
  );
}

// ── SITUAÇÃO ──────────────────────────────────────────────────
export function SkeletonSituacao() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <div className="border-b bg-card/60 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-16 rounded" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {[1,2,3,4,5,6,7].map(i => (
          <Card key={i}><CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-48" />
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
