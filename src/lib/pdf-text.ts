// Extração de texto de PDF no navegador, via pdf.js.
//
// O pdf.js devolve fragmentos soltos com coordenadas; aqui eles são reagrupados
// em linhas (mesmo Y) e ordenados da esquerda para a direita, para que o parser
// da fatura possa trabalhar com linhas de texto como as de um extrato.

interface Frag {
  x: number;
  y: number;
  str: string;
}

// O pdf.js pesa ~2MB e só faz falta a quem importa fatura, então entra por
// import dinâmico — fora do bundle inicial.
async function carregarPdfjs() {
  const [pdfjsLib, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjsLib;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await carregarPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const paginas: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const frags: Frag[] = [];
    for (const item of content.items) {
      // TextMarkedContent não tem `str`; só interessam os TextItem.
      if (!("str" in item) || !item.str.trim()) continue;
      frags.push({
        x: item.transform[4],
        y: item.transform[5],
        str: item.str,
      });
    }

    // Agrupa por linha: Y próximos (tolerância de 2pt) são a mesma linha.
    const linhas = new Map<number, Frag[]>();
    for (const f of frags) {
      const chave = Math.round(f.y / 2);
      const atual = linhas.get(chave);
      if (atual) atual.push(f);
      else linhas.set(chave, [f]);
    }

    const texto = [...linhas.entries()]
      .sort((a, b) => b[0] - a[0]) // topo da página primeiro
      .map(([, fs]) =>
        fs
          .sort((a, b) => a.x - b.x)
          .map((f) => f.str.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s{2,}/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n");

    paginas.push(texto);
  }

  return paginas.join("\n");
}
