# Расчёт суточной нормы кормления смесью у детей 0–6 месяцев

## Финальный консолидированный спек для разработки приложения

**Назначение:** технический документ для команды разработки: формулы, константы, границы валидации и алгоритм расчёта ориентировочного суточного объёма молочной смеси для детей 0–6 месяцев.

**Область применения:** здоровые доношенные дети на полном искусственном вскармливании. Недоношенные, дети с низкой массой, ЗВУР, лечебными смесями, врождёнными заболеваниями, метаболическими нарушениями — отдельный clinician-mode.

**Ключевой принцип:** расчёт — ориентир, не обязательная цель. UI должен поддерживать responsive feeding: кормление по сигналам голода и насыщения.

---

# 1. Итоговая позиция

Для production-калькулятора использовать два метода:

1. **Основной метод:** FAO/WHO/UNU energy-based
   Учитывает возрастное снижение потребности в ккал/кг/сут.

2. **Sanity-check метод:** AAP volume-based
   Простая практическая проверка: около 163–165 мл/кг/сут, с мягким AAP-потолком около 960 мл/сут.

Рекомендация для UI: показывать оба значения или одно основное FAO-значение + AAP как проверочный диапазон.

---

# 2. Плотность смеси

Стандартная infant formula по Codex Alimentarius в готовом виде:

| Параметр               |                          Значение |
| ---------------------- | --------------------------------: |
| Минимум                |                  60 ккал / 100 мл |
| Максимум               |                  70 ккал / 100 мл |
| Типичный fallback      |                  67 ккал / 100 мл |
| Типичная US-маркировка | 20 kcal / oz ≈ 67.6 ккал / 100 мл |

## Логика

```ts
if (labelKcalPer100ml) {
  D = labelKcalPer100ml;
} else if (labelKcalPerOz) {
  D = (labelKcalPerOz / 29.5735) * 100;
} else {
  D = 67;
  flag("estimated_density_default");
}
```

Если `standardFormula = true` и `D < 60 || D > 70`, показывать предупреждение: возможно, это не стандартная смесь для доношенных детей.

---

# 3. Основной метод: FAO/WHO/UNU energy-based

## Формула

```ts
dailyKcal = weightKg * kcalPerKgByAge;
dailyVolumeMl = (dailyKcal * 100) / formulaKcalPer100ml;
```

## Таблица FAO/WHO/UNU для formula-fed infants

| Возраст | ккал/кг/сут | мл/кг/сут при 67 ккал/100 мл |
| ------: | ----------: | ---------------------------: |
|   1 мес |         120 |                          179 |
|   2 мес |         109 |                          163 |
|   3 мес |         100 |                          149 |
|   4 мес |          87 |                          130 |
|   5 мес |          86 |                          128 |
|   6 мес |          84 |                          125 |

Это основная таблица для расчёта после стабилизации кормления.

---

# 4. Sanity-check: AAP volume-based

AAP practical rule:

```ts
dailyVolumeMl = weightKg * 163;
```

Допустимо округлить до:

```ts
dailyVolumeMl = weightKg * 165;
```

Разница клинически несущественная.

AAP также указывает, что ребёнок обычно не должен получать больше около:

```ts
960 ml/day
```

Но это **soft warning**, не жёсткий медицинский запрет.

```ts
aapVolumeMl = weightKg * 163;

if (aapVolumeMl > 960) {
  flag({
    type: "warning",
    source: "AAP",
    message: "AAP usually-no-more-than 960 ml/day threshold exceeded",
  });
}
```

Важно: этот потолок атрибутируется **только AAP**, не CDC.

---

# 5. Возрастное ветвление

## 5.1. Первые дни / ранний новорождённый период

Для первых дней жизни не выдавать одну суточную “норму” как цель.

Показывать:

| Параметр           |                 Значение |
| ------------------ | -----------------------: |
| Объём на кормление |                 30–60 мл |
| Частота            |       8–12 кормлений/сут |
| Интервал           | примерно каждые 2–3 часа |
| Принцип            |       responsive feeding |

Для периода до 14 дней можно использовать ту же conservative product policy: не форсировать суточный объём, а показывать per-feed guidance + частоту + контроль веса/мочеиспусканий.

**Не включать в основной движок посуточную эскалацию мл/кг из NICE NG29/Holliday–Segar.** Это относится к общей жидкости/стационарному контексту, а не к consumer formula calculator.

---

## 5.2. 14 дней – 6 месяцев

Использовать:

```ts
primary = FAO_energy;
secondary = AAP_simple;
```

---

# 6. Разрешение возраста

Возраст должен задаваться в днях.

Рекомендуемая бакетизация:

```ts
ageMonths = floor(ageDays / 30.4375);
```

Но для FAO-таблицы удобнее зафиксировать бакеты:

| ageDays | bucket |
| ------: | -----: |
|   14–44 |  1 мес |
|   45–74 |  2 мес |
|  75–104 |  3 мес |
| 105–134 |  4 мес |
| 135–164 |  5 мес |
| 165–183 |  6 мес |

Правило бакетизации должно быть явно задокументировано в коде.

---

# 7. Почему FAO основной, а AAP sanity-check

AAP даёт плоское правило около 163–165 мл/кг. Оно удобно, но не учитывает возрастное снижение энергетической потребности.

FAO показывает снижение:

```text
120 → 109 → 100 → 87 → 86 → 84 kcal/kg/day
```

Поэтому в 3–4 месяца AAP без потолка может завышать объём, а с потолком часто упирается в 960 мл. FAO физиологичнее как основной расчёт.

---

# 8. Частота кормлений

| Возраст       | Кормлений/сут |
| ------------- | ------------: |
| 0–1 нед       |          8–12 |
| 1 нед – 1 мес |          8–10 |
| 1–2 мес       |           6–8 |
| 2–4 мес       |           5–7 |
| 4–6 мес       |           4–6 |

Использовать для распределения суточного объёма:

```ts
perFeedMl = dailyVolumeMl / feedsPerDay;
```

Если per-feed объём выглядит чрезмерным, лучше предлагать увеличить частоту, а не повышать разовый объём.

---

# 9. Валидация и флаги

## HARD validation

```ts
weightKg > 0;
ageDays >= 0;
```

Если заданы обе плотности:

```ts
abs(convertedOzDensity - kcalPer100ml) > 2%
```

→ ошибка ввода.

---

## SOFT guideline flags

```ts
mlPerKg = dailyVolumeMl / weightKg;
```

Флаги:

| Условие                         | Severity     | Комментарий                         |
| ------------------------------- | ------------ | ----------------------------------- |
| `< 120 мл/кг/сут`               | info/warning | проверить возраст, вес, плотность   |
| `> 200 мл/кг/сут`               | warning      | возможный перекорм или ошибка ввода |
| `> 960 мл/сут`                  | warning      | AAP soft threshold                  |
| `formula density outside 60–70` | warning      | возможно не standard formula        |

---

## Research-note флаг

Порог `≥840 мл/сут` можно оставить только как research-note, не guideline.

```ts
if (dailyVolumeMl >= 840) {
  flag({
    type: "research_note",
    message:
      "Some cohort data associated high formula volume with later overweight risk; not a guideline limit.",
  });
}
```

Этот флаг не должен визуально выглядеть как медицинский запрет.

---

# 10. Недоношенные / LBW / clinician-mode

Не применять базовый term-алгоритм.

Ориентиры ESPGHAN для preterm:

| Параметр                      |                                        Значение |
| ----------------------------- | ----------------------------------------------: |
| Энергия                       |                             115–140 ккал/кг/сут |
| При плохом росте              | возможно выше, но не >160 ккал/кг/сут без врача |
| Объём                         |                               150–180 мл/кг/сут |
| Нижний практический предел    |                             около 135 мл/кг/сут |
| Верхний индивидуальный предел |                                до 200 мл/кг/сут |

Если расчёт выходит за эти границы, приложение должно не “докручивать мл”, а рекомендовать clinician review.

---

# 11. Рефлюкс / срыгивания / беспокойство

Не снижать автоматически суточный объём только из-за:

- срыгиваний,
- колик,
- плача,
- беспокойства.

Правильная логика:

```ts
if (refluxSymptoms && dailyVolumeNotExcessive) {
  suggest("smaller, more frequent feeds");
}
```

Если объём действительно чрезмерен для веса, показать предупреждение и рекомендовать обсудить с педиатром.

---

# 12. Исключено из production-движка

| Метод                                           | Статус            | Причина                                           |
| ----------------------------------------------- | ----------------- | ------------------------------------------------- |
| Advanced EER с ростом/полом/возрастом `−716...` | excluded          | не для 0–6 мес; риск ошибки единиц возраста       |
| Финкельштейн                                    | historical only   | не современный международный стандарт             |
| Апперт                                          | historical only   | не современный международный стандарт             |
| Дольный метод 1/5–1/7 массы                     | historical only   | устаревшая методология                            |
| Holliday–Segar 100 мл/кг                        | reference only    | поддерживающая жидкость, не формула-кормление     |
| NICE NG29 daily fluid ramp                      | reference only    | стационарная жидкость, не consumer formula target |
| 840 мл как лимит                                | excluded as limit | только research-note                              |

---

# 13. EFSA / EU nuance

Есть методологическая развилка: современные смеси по составу ближе к грудному молоку, поэтому в некоторых европейских анализах допускается использование breastfed-equation для оценки потребностей.

Но для production default:

```ts
energyBasis = "FAO_formula_fed";
```

Опционально:

```ts
energyBasis = "EU_breastfed_equation";
```

Только как advanced/research mode, не default.

---

# 14. Псевдокод

```ts
type FeedingInput = {
  ageDays: number;
  weightKg: number;
  kcalPer100ml?: number;
  kcalPerOz?: number;
  standardFormula?: boolean;
  mode?: "FAO_energy" | "AAP_simple";
};

const FAO_KCAL_PER_KG = {
  1: 120,
  2: 109,
  3: 100,
  4: 87,
  5: 86,
  6: 84,
};

function resolveDensity(input: FeedingInput) {
  if (input.kcalPer100ml) return input.kcalPer100ml;
  if (input.kcalPerOz) return (input.kcalPerOz / 29.5735) * 100;
  return 67;
}

function resolveMonthBucket(ageDays: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (ageDays <= 44) return 1;
  if (ageDays <= 74) return 2;
  if (ageDays <= 104) return 3;
  if (ageDays <= 134) return 4;
  if (ageDays <= 164) return 5;
  return 6;
}

function calculateFormulaVolume(input: FeedingInput) {
  if (input.weightKg <= 0) throw new Error("Invalid weight");
  if (input.ageDays < 0) throw new Error("Invalid age");

  const flags = [];
  const density = resolveDensity(input);

  if (input.standardFormula !== false && (density < 60 || density > 70)) {
    flags.push({
      type: "warning",
      code: "density_out_of_codex_range",
    });
  }

  if (input.ageDays < 14) {
    return {
      type: "early_newborn_guidance",
      perFeedMl: [30, 60],
      feedsPerDay: [8, 12],
      dailyVolumeMl: null,
      note: "Use responsive feeding; single daily target is not provided.",
      flags,
    };
  }

  const month = resolveMonthBucket(input.ageDays);
  const kcalPerKg = FAO_KCAL_PER_KG[month];

  const faoKcalDay = input.weightKg * kcalPerKg;
  const faoMlDay = (faoKcalDay * 100) / density;

  const aapRawMlDay = input.weightKg * 163;
  const aapMlDay = Math.min(aapRawMlDay, 960);

  if (aapRawMlDay > 960) {
    flags.push({
      type: "warning",
      code: "aap_soft_cap_exceeded",
      source: "AAP",
    });
  }

  const mode = input.mode ?? "FAO_energy";
  const primaryMlDay = mode === "AAP_simple" ? aapMlDay : faoMlDay;
  const sanityCheckMlDay = mode === "AAP_simple" ? faoMlDay : aapMlDay;

  const mlPerKg = primaryMlDay / input.weightKg;

  if (mlPerKg < 120 || mlPerKg > 200) {
    flags.push({
      type: "warning",
      code: "outside_typical_ml_per_kg_range",
    });
  }

  if (primaryMlDay >= 840) {
    flags.push({
      type: "research_note",
      code: "high_volume_observational_association",
    });
  }

  return {
    type: "calculated_estimate",
    method: mode,
    primaryMlDay: Math.round(primaryMlDay),
    sanityCheckMlDay: Math.round(sanityCheckMlDay),
    densityUsed: density,
    kcalPerKg,
    flags,
    disclaimer:
      "Estimated intake only. Use responsive feeding and growth monitoring.",
  };
}
```

---

# 15. Примеры

## Пример 1

Ребёнок 4 кг, 2 месяца, смесь 67 ккал/100 мл.

FAO:

```text
109 × 4 = 436 ккал/сут
436 × 100 / 67 = 651 мл/сут
```

AAP:

```text
4 × 163 = 652 мл/сут
```

Методы совпали.

---

## Пример 2

Ребёнок 6 кг, 5 месяцев, смесь 67 ккал/100 мл.

FAO:

```text
86 × 6 = 516 ккал/сут
516 × 100 / 67 = 770 мл/сут
```

AAP:

```text
6 × 163 = 978 мл/сут → AAP soft warning / practical cap около 960 мл
```

---

## Пример 3

Ребёнок 5 дней.

Не выдавать суточную норму.
Показывать:

```text
30–60 мл за кормление
8–12 кормлений/сут
responsive feeding
```

---

# 16. Источники

1. FAO/WHO/UNU — Human Energy Requirements, 2004
   https://www.fao.org/4/y5686e/y5686e05.htm

2. Codex Alimentarius CXS 72-1981 — Standard for Infant Formula
   https://www.fao.org/input/download/standards/288/CXS_072e.pdf

3. AAP / HealthyChildren — Amount and Schedule of Baby Formula Feedings
   https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/amount-and-schedule-of-formula-feedings.aspx

4. CDC — How Much and How Often to Feed Infant Formula
   https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html

5. IOM 2002 — Dietary Reference Intakes / EER infant equations

6. ESPGHAN — Enteral Nutrition in Preterm Infants, 2022

7. WHO — Recommendations for care of the preterm or low-birth-weight infant, 2022
   https://iris.who.int/items/4a14b190-bf5a-430d-982a-8bcaf9ae3562

8. NICE / BNFC — Enteral nutrition treatment summaries
   https://bnfc.nice.org.uk/treatment-summaries/enteral-nutrition/

9. Huang J. et al. Nutr J. 2018;17(1):12 — observational association of high formula volume and overweight risk

---

# 17. Final Product Decision

Для приложения принять:

```ts
defaultPrimaryMethod = "FAO_energy";
defaultSecondaryMethod = "AAP_simple";
defaultDensity = "label_value_or_67";
earlyNewbornMode = "per_feed_guidance_only";
pretermMode = "clinician_only";
```

Не использовать:

- жёсткие цели потребления,
- автоматическое снижение объёма при рефлюксе,
- historical formulas как дефолт,
- Holliday–Segar/NICE fluid ramp как formula-feeding engine,
- advanced EER equations для 0–6 месяцев.
