
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { SerializedMedication } from "@leon/contracts/serialized";
import { medicationsKey } from "@/components/day-view/feedingsKey";
import { useIsMobile } from "@/hooks/use-mobile";
import { createMedication, patchMedication } from "@/lib/api/medications";
import { httpErrorBody, httpStatus } from "@/lib/api/errors";
import {
  medicationFormSchema,
  toMedicationApiBody,
  type MedicationFormOut,
  type MedicationFormValues,
} from "~/lib/forms/medicationForm";

type State =
  | null
  | { kind: "create" }
  | { kind: "edit"; medication: SerializedMedication };

type Props = {
  state: State;
  onOpenChange: (open: boolean) => void;
  babyId: string;
};

type MedicationApiBody = ReturnType<typeof toMedicationApiBody>;

export function MedicationSheet({ state, onOpenChange, babyId }: Props) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const editing = state?.kind === "edit" ? state.medication : null;

  const form = useForm<MedicationFormValues, unknown, MedicationFormOut>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: {
      name: editing?.name ?? "",
      dose: editing?.defaultDoseDrops ?? 1,
    },
  });

  const create = useMutation({
    mutationFn: async (body: MedicationApiBody) => {
      try {
        return await createMedication(body);
      } catch (err) {
        if (httpStatus(err) === 409) {
          const data = httpErrorBody<{ error?: string }>(err);
          throw new Error(data?.error ?? "conflict");
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "duplicate_name") {
        form.setError("name", {
          type: "server",
          message: "Лекарство с таким названием уже существует",
        });
      } else {
        toast.error("Не удалось сохранить");
      }
    },
  });

  const patch = useMutation({
    mutationFn: async (body: MedicationApiBody) => {
      if (!editing) throw new Error("not edit");
      try {
        return await patchMedication(editing._id, body);
      } catch (err) {
        if (httpStatus(err) === 409) {
          const data = httpErrorBody<{ error?: string }>(err);
          throw new Error(data?.error ?? "conflict");
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "duplicate_name") {
        form.setError("name", {
          type: "server",
          message: "Лекарство с таким названием уже существует",
        });
      } else {
        toast.error("Не удалось сохранить");
      }
    },
  });

  const isPending = create.isPending || patch.isPending;

  function onValid(v: MedicationFormOut) {
    const body = toMedicationApiBody(v);
    if (editing) patch.mutate(body);
    else create.mutate(body);
  }

  return (
    <Sheet open={state !== null} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"}>
        <SheetHeader>
          <SheetTitle>
            {editing ? "Редактировать лекарство" : "Новое лекарство"}
          </SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onValid)} className="contents">
            <div className="space-y-4 px-4 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input type="text" maxLength={50} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Доза, капель</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="gap-2">
              <SheetClose asChild>
                <Button type="button" variant="ghost" disabled={isPending}>
                  Отмена
                </Button>
              </SheetClose>
              <Button type="submit" disabled={isPending}>
                Сохранить
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
