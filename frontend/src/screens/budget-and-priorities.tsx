import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppAlert } from "@/components/app/app-alert"
import { CHIP_GROUP_CLASS, CHIP_ITEM_CLASS } from "@/components/app/chip"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  PRIORITY_OPTIONS,
  formatMoney,
  midpointPerGuest,
  orderPriorities,
  priorityLabel,
  priorityNotice,
  type BudgetValues,
} from "@/lib/budget"

export const EMPTY_BUDGET: BudgetValues = {
  budgetLow: BUDGET_MIN,
  budgetHigh: BUDGET_MAX,
  priorities: [],
}

type BudgetProps = {
  guestCount: number
  currency: string
  initialValues?: BudgetValues
  onBack?: () => void
  onNext?: (values: BudgetValues) => void
}

// Step 2 of 4: Budget and priorities. Layout and copy follow wireframes 5.1 to 5.4 on the Doop canvas.
export function BudgetPrioritiesScreen({
  guestCount,
  currency,
  initialValues = EMPTY_BUDGET,
  onBack,
  onNext,
}: BudgetProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<BudgetValues>(initialValues)
  const notice = priorityNotice(values.priorities.length)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onNext?.(values)
      }}
      className="grid w-[720px] max-w-full content-start gap-6"
    >
      <p className="text-[length:var(--text-label)] text-muted">{t("budget.step")}</p>
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("budget.title")}</h2>

      <div className="grid gap-2">
        <div className="flex justify-between text-[length:var(--text-label)] text-ink">
          <span>{t("budget.total")}</span>
          <output>
            {formatMoney(values.budgetLow, currency)} to {formatMoney(values.budgetHigh, currency)}
          </output>
        </div>
        <Slider
          aria-label={t("budget.total")}
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          value={[values.budgetLow, values.budgetHigh]}
          onValueChange={([budgetLow, budgetHigh]) =>
            setValues((current) => ({ ...current, budgetLow, budgetHigh }))
          }
          className="relative flex w-full touch-none items-center select-none"
        />
      </div>

      <p className="text-[length:var(--text-label)] text-muted">
        {t("budget.perGuest", {
          amount: formatMoney(midpointPerGuest(values.budgetLow, values.budgetHigh, guestCount), currency),
        })}
      </p>

      <div className="grid gap-3">
        <span className="text-[length:var(--text-label)] text-ink">{t("budget.matters")}</span>
        <ToggleGroup
          type="multiple"
          value={values.priorities}
          onValueChange={(next) =>
            setValues((current) => ({ ...current, priorities: orderPriorities(next) }))
          }
          aria-label={t("budget.matters")}
          className={CHIP_GROUP_CLASS}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <ToggleGroupItem key={option} value={option} className={CHIP_ITEM_CLASS}>
              {priorityLabel(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {notice ? <AppAlert>{notice}</AppAlert> : null}

      <div className="mt-3 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button type="submit">{t("common.next")}</Button>
      </div>
    </form>
  )
}
