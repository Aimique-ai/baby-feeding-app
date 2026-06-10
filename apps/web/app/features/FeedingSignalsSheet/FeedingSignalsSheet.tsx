import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useIsMobile } from "~/hooks/useMobile";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const HUNGER = [
  "Причмокивает, облизывает губы, высовывает язык",
  "Поворачивает голову и открывает рот в поиске (поисковый рефлекс)",
  "Тянет руки в рот, сосёт кулачок или пальцы",
  "Беспокоится, кряхтит, ёрзает — ранние знаки",
  "Плач — поздний сигнал; успокойте и затем предложите бутылочку",
];

const SATIETY = [
  "Отворачивается от бутылочки, сжимает губы",
  "Замедляет или прекращает сосать, выталкивает соску языком",
  "Расслабляет руки, разжимает кулачки, тело становится мягким",
  "Засыпает, отвлекается, теряет интерес",
];

function SignalGroup({
  title,
  dotClass,
  items,
}: {
  title: string;
  dotClass: string;
  items: string[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={"size-1.5 rounded-full " + dotClass} aria-hidden />
        {title}
      </h3>
      <ul role="list" className="space-y-1.5">
        {items.map((s) => (
          <li
            key={s}
            className="flex items-baseline gap-2 text-sm text-foreground"
          >
            <span
              className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60"
              aria-hidden
            />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeedingSignalsSheet({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"}>
        <SheetHeader>
          <SheetTitle>Сигналы голода и сытости</SheetTitle>
          <SheetDescription>
            Бутылочное кормление. Ориентируйтесь на ребёнка, а не на часы или
            остаток в бутылочке.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          <SignalGroup title="Хочет есть" dotClass="bg-warning" items={HUNGER} />
          <SignalGroup title="Наелся" dotClass="bg-success" items={SATIETY} />
          <p className="text-xs text-muted-foreground">
            Не заставляйте допивать остаток. Источники: AAP, CDC, WHO.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
