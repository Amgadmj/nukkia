import { useMemo, useRef, useState } from "react";
import { BookOpen, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { brandBookFilename, buildBrandBookDocument, type BrandBookInput } from "@/lib/brand-story";

export function BrandBook({ input }: { input: BrandBookInput }) {
  const document = useMemo(() => buildBrandBookDocument(input), [input]);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loadedDocument, setLoadedDocument] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  function downloadHtml() {
    const url = URL.createObjectURL(new Blob([document], { type: "text/html;charset=utf-8" }));
    const link = window.document.createElement("a");
    try {
      link.href = url;
      link.download = brandBookFilename(input.company.name);
      window.document.body.append(link);
      link.click();
    } catch {
      toast.error("Não foi possível baixar o HTML neste navegador.");
    } finally {
      link.remove();
      // Let the browser start consuming the blob before releasing its URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function print() {
    const target = frame.current?.contentWindow;
    if (!target || !frame.current?.contentDocument || loadedDocument !== document) {
      toast.error("Aguarde o carregamento do BrandBook e tente novamente.");
      return;
    }
    setPrinting(true);
    let timeout: number | undefined;
    try {
      // Don't hang on expired signed logo URLs; no external font requests.
      await Promise.race([
        Promise.all(
          Array.from(frame.current.contentDocument.images).map((image) =>
            image.decode().catch(() => {}),
          ),
        ),
        new Promise((resolve) => {
          timeout = window.setTimeout(resolve, 3000);
        }),
      ]);
      if (target.closed) return;
      target.focus();
      target.print();
    } catch {
      toast.error("Não foi possível abrir a impressão neste navegador.");
    } finally {
      window.clearTimeout(timeout);
      setPrinting(false);
    }
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background/50">
            <BookOpen aria-hidden="true" className="size-4 text-primary" />
          </span>
          <div>
            <h2 className="text-base font-semibold">BrandBook</h2>
            <CardDescription className="mt-1 max-w-lg leading-relaxed">
              Negócio, identidade e história, com exemplos de aplicação e propostas de slogan
              sinalizadas.
            </CardDescription>
          </div>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">
          Dados salvos · propostas sinalizadas
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-xs text-muted-foreground">Edições não salvas não entram na prévia.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={print}
              disabled={printing || loadedDocument !== document}
            >
              <Printer className="size-4" />
              {printing ? "Preparando impressão..." : "Imprimir / salvar PDF"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={downloadHtml}>
              <Download className="size-4" />
              Baixar HTML
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-muted p-2 sm:p-4">
          <iframe
            ref={frame}
            title={`BrandBook de ${input.company.name}`}
            srcDoc={document}
            onLoad={() => setLoadedDocument(document)}
            sandbox="allow-same-origin allow-modals"
            className="h-[min(72svh,760px)] min-h-96 w-full rounded-md border-0 bg-white"
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Na impressão, escolha “Salvar como PDF”, se disponível. Se ela não abrir, baixe o HTML e
          abra em outro navegador. O logo pode precisar de internet; fontes não instaladas usam uma
          substituição local.
        </p>
      </CardContent>
    </Card>
  );
}
