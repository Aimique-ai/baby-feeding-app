import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Share } from "lucide-react";
import { Button } from "~/components/ui/button";
import { H4, Muted } from "~/components/ui/typography";
import { listBabies } from "~/lib/api/babies";
import { babiesKey } from "~/lib/queryKeys";
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  getPushStatus,
} from "~/lib/api/push";
import { detectPushEnvironment, urlBase64ToUint8Array } from "./utils";

export function PushSetup() {
  const [env] = useState(detectPushEnvironment);
  const babiesQ = useQuery({
    queryKey: babiesKey,
    queryFn: () => listBabies(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subscribedIds, setSubscribedIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!env.pushAvailable) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          if (!cancelled) setSubscribedIds([]);
          return;
        }
        const status = await getPushStatus(sub.endpoint);
        if (!cancelled) {
          setSubscribedIds(status.subscribed ? status.babyIds : []);
          if (status.subscribed) setSelected(new Set(status.babyIds));
        }
      } catch {
        if (!cancelled) setSubscribedIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env.pushAvailable]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enable = async () => {
    if (selected.size === 0) {
      toast.error("Выберите хотя бы одного ребёнка");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Разрешение на уведомления не выдано");
        return;
      }
      const key = await getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const babyIds = Array.from(selected);
      await subscribePush({
        subscription: sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
        babyIds,
      });
      setSubscribedIds(babyIds);
      toast.success("Напоминания включены");
    } catch (err) {
      console.error("[push] enable failed", err);
      toast.error("Не удалось включить напоминания");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribePush(endpoint);
      }
      setSubscribedIds([]);
      toast.success("Напоминания выключены");
    } catch (err) {
      console.error("[push] disable failed", err);
      toast.error("Не удалось выключить напоминания");
    } finally {
      setBusy(false);
    }
  };

  // iOS in a normal Safari tab: Push API is absent by design — instruct the
  // user to install the PWA to the home screen first.
  if (!env.pushAvailable) {
    return (
      <section>
        <H4 className="mb-1">Напоминания о кормлении</H4>
        {env.isIOS ? (
          <div className="space-y-2">
            <Muted>
              Чтобы получать напоминания на iPhone, добавьте приложение на
              домашний экран:
            </Muted>
            <ol className="list-inside list-decimal text-sm text-muted-foreground">
              <li className="flex items-center gap-1">
                Нажмите <Share className="inline size-4" aria-hidden /> Поделиться
              </li>
              <li>Выберите «На экран „Домой“»</li>
              <li>Откройте приложение с домашнего экрана</li>
            </ol>
          </div>
        ) : (
          <Muted>Этот браузер не поддерживает push-уведомления.</Muted>
        )}
      </section>
    );
  }

  const isSubscribed = (subscribedIds?.length ?? 0) > 0;
  const babies = babiesQ.data ?? [];

  return (
    <section>
      <H4 className="mb-1">Напоминания о кормлении</H4>
      <Muted className="mb-4">
        Push за 30 минут до следующего планового кормления. Выберите, о ком
        напоминать на этом устройстве.
      </Muted>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {babies.map((b) => {
          const active = selected.has(b._id);
          return (
            <Button
              key={b._id}
              variant="outline"
              onClick={() => toggle(b._id)}
              aria-pressed={active}
              disabled={busy}
              className={`h-auto w-full justify-start gap-2 p-3 text-left font-normal ${
                active ? "border-primary ring-2 ring-ring/40" : "border-border"
              }`}
            >
              <span className="text-sm font-medium">{b.name}</span>
              {active && (
                <Check
                  className="ml-auto size-4 text-primary"
                  aria-label="Выбрано"
                />
              )}
            </Button>
          );
        })}
        {babies.length === 0 && (
          <Muted className="col-span-full">Нет активных детей.</Muted>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={enable} disabled={busy || selected.size === 0}>
          {isSubscribed ? "Обновить" : "Включить напоминания"}
        </Button>
        {isSubscribed && (
          <Button variant="ghost" onClick={disable} disabled={busy}>
            Выключить
          </Button>
        )}
      </div>
    </section>
  );
}
