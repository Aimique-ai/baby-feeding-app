import type { VerdictReasonCode, VerdictStatus } from "@leon/domain/who/types";
import { STATUS_COLORING_CODES } from "@leon/domain/who/verdict";

// The domain provides semantics; color, icon, and copy are assigned here.

export type StatusKind = "green" | "yellow" | "red";

// Source of truth is the domain (STATUS_COLORING_CODES). Anything that doesn't
// color the status (including growth-on-track) is a neutral observation.
export function isStatusReason(code: VerdictReasonCode): boolean {
  return (STATUS_COLORING_CODES as ReadonlySet<VerdictReasonCode>).has(code);
}

export const STATUS_VIEW: Record<
  VerdictStatus,
  { kind: StatusKind; title: string }
> = {
  "on-track": {
    kind: "green",
    title: "Малыш растёт хорошо",
  },
  recheck: {
    kind: "yellow",
    title: "Стоит присмотреться",
  },
  "clinical-attention": {
    kind: "red",
    title: "Лучше показать педиатру",
  },
};

export type ReasonView = {
  text: string;
  affordance: string | null;
};

export const REASON_VIEW: Record<VerdictReasonCode, ReasonView> = {
  "growth-on-track": {
    text: "Вес набирается ожидаемо — питания, скорее всего, хватает.",
    affordance: null,
  },
  "below-p2": {
    text: "Вес ниже, чем у большинства сверстников по меркам ВОЗ. Стоит показать малыша педиатру — это сигнал понаблюдать, а не диагноз.",
    affordance: null,
  },
  "early-loss-over-10": {
    text: "Малыш потерял больше 10% веса с рождения. Это повод показаться врачу, а не сразу докармливать.",
    affordance: null,
  },
  "no-regain-by-3w": {
    text: "К трём неделям вес ещё не вернулся к тому, что был при рождении. Стоит обсудить с педиатром.",
    affordance: null,
  },
  "corridor-drop-red": {
    text: "Вес несколько раз подряд смещается вниз относительно своей кривой роста. Стоит обсудить это с педиатром — это сигнал, а не диагноз.",
    affordance: null,
  },
  "corridor-drop-warn": {
    text: "Вес чуть сместился вниз по своей кривой роста. Пока это просто наблюдение — имеет смысл взвесить ещё раз через неделю.",
    affordance: null,
  },
  "velocity-low-mild": {
    text: "За прошлый месяц малыш набирал чуть медленнее среднего. Это просто наблюдение.",
    affordance: null,
  },
  "velocity-low-strong": {
    text: "За прошлый месяц малыш набирал заметно медленнее среднего. Если сомневаешься — взвесь ещё раз через неделю.",
    affordance: null,
  },
  "fresh-deficit-vs-stale-velocity": {
    text: "Последние дни малыш ел меньше нормы — на прибавке это пока не отразилось. Просто наблюдение.",
    affordance: null,
  },
  "early-loss-near-10-info": {
    text: "Потеря приближается к 10% от веса рождения. На смеси она обычно меньше, и вес возвращается быстрее, чем на грудном.",
    affordance: null,
  },
  "fast-gain-info": {
    text: "Малыш набирает быстро. По одному весу это не оценить — нужен ещё и рост. После трёх месяцев на смеси такое ускорение — обычное дело.",
    affordance: null,
  },
  "fresh-deficit-neutral-info": {
    text: "Последние дни питание было ниже нормы. Чтобы оценить темп роста, нужно следующее взвешивание.",
    affordance: null,
  },
};
