## Implementar página /compras

Substituir o placeholder atual em `src/routes/compras.tsx` por uma página completa de gestão de listas de compras, seguindo o padrão visual já usado em `/estoque` e `/contas`.

### Estrutura do arquivo

Manter a `createFileRoute("/compras")` existente. Trocar o componente `ComprasPage` pela implementação descrita abaixo.

### Estado e dados

- `useAuth()` + redirect para `/auth` se não logado (mesmo padrão de estoque.tsx).
- `familyId` resolvido via `profiles.family_id`.
- `lists`: `shopping_lists` filtradas por `family_id`, ordem `created_at desc`.
- `itemsByList`: `Record<listId, ShoppingItem[]>` carregado on-demand quando o usuário expande uma lista.
- `tab`: `"aberta" | "em_andamento" | "concluida"` (default `"aberta"`).
- Skeletons enquanto carrega; toast em todas as ações.

### Layout

```text
┌─ Header: 🛒 Compras                [+ Nova lista] ─┐
├─ 3 cards resumo: Listas abertas | Itens pendentes | R$ estimado
├─ Tabs: [Abertas] [Em andamento] [Concluídas]
└─ Lista de cards de shopping_lists filtradas pela tab
     └─ Accordion expandindo itens inline
```

### Card de lista

- Nome + ícone fixo (🛒).
- Subtítulo: `X itens · Y comprados · R$ total_estimado` (ou `total_real` se todos comprados).
- Badge de status (cinza/azul/verde).
- `data_prevista` formatada (pt-BR) e `local_preferido` se preenchidos.
- `Progress` (shadcn) com `comprados/total`.
- Botões: Editar (abre dialog de edição reutilizando o de nova lista), Excluir (AlertDialog confirmando), e toggle "Ver itens".

### Itens (Accordion expandido)

- Query: `shopping_items.select("*").eq("list_id", id).order("comprado").order("nome")`.
- Cada linha: `Checkbox`, nome, `qtd unidade`, `R$ preco_estimado`. Quando marcado e ainda sem `preco_real`, mostrar input numérico inline para preço real (atualiza ao blur).
- Toggle do checkbox: `update shopping_items set comprado=!comprado, comprado_em = comprado ? now() : null`.
- Após toggle, se todos os itens da lista estiverem `comprado=true` e a lista não estiver `concluida`: abrir AlertDialog perguntando se quer marcar a lista como concluída → `update shopping_lists set status='concluida'`.
- Botão "+ Adicionar item" abre o dialog de novo item para esta lista.

### Dialog — Nova lista (também usado para editar)

Campos:
- `nome` (Input, obrigatório)
- `data_prevista` (shadcn DatePicker — Calendar dentro de Popover, com `pointer-events-auto`)
- `local_preferido` (Select com `Supermercado Mateus | Sam's Club | Atacadão | Outro`; ao escolher Outro, mostrar Input livre)

Salvar → `insert` ou `update` em `shopping_lists` com `status: 'aberta'` quando novo.

### Dialog — Novo item

Campos:
- `nome` (Input com sugestões de `products.nome` da família — `datalist` HTML simples para evitar criar Combobox novo)
- `quantidade` (Input number, default 1)
- `unidade` (Select: `un | kg | g | L | ml | cx | pct`)
- `preco_estimado` (Input number, R$)

Após `insert` em `shopping_items`, recalcular total da lista:
- `select sum(preco_estimado * quantidade)` em `shopping_items where list_id=...`
- `update shopping_lists set total_estimado = soma`

Mesma lógica é executada após excluir item, editar quantidade/preço, ou marcar item como comprado com `preco_real` (recalcular `total_real` paralelamente).

### Cards-resumo (topo)

Calculados em memória a partir das listas + itens já carregados:
- `📋 listas abertas`: `lists.filter(status !== 'concluida').length`
- `🛒 itens pendentes`: soma de itens não comprados nas listas abertas (precisa carregar contagem; usar `count: 'exact', head: true` em `shopping_items` filtrado por `list_id in (abertas)` e `comprado=false`).
- `💰 R$ estimado`: `sum(total_estimado)` das listas abertas.

### Tipos TS

Como `shopping_lists`/`shopping_items` não estão tipadas em `types.ts`, usar `from("shopping_lists" as any)` (mesmo padrão de `services/index.ts`) e tipos locais:

```ts
type ShoppingList = { id: string; nome: string; status: 'aberta'|'em_andamento'|'concluida'; data_prevista: string|null; local_preferido: string|null; total_estimado: number; total_real: number; created_at: string };
type ShoppingItem = { id: string; list_id: string; nome: string; quantidade: number; unidade: string; preco_estimado: number|null; preco_real: number|null; comprado: boolean; comprado_em: string|null };
```

### Componentes shadcn reutilizados

`Button, Card, Badge, Input, Label, Select, Dialog, AlertDialog, Tabs, Checkbox, Progress, Accordion, Popover, Calendar, Skeleton` — todos já presentes no projeto. Toast via `sonner`.

### Arquivos alterados

- `src/routes/compras.tsx` — única edição.

Sem migrations, sem mudanças em sidebar (link já existe), sem alterar tipos gerados.
