import { useState } from "react"
import { useTranslation } from "react-i18next"

import { CHIP_GROUP_CLASS, CHIP_ITEM_CLASS } from "@/components/app/chip"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DIETARY_OPTIONS,
  EMPTY_WEDDING,
  STYLE_OPTIONS,
  TRADITIONS_MAX,
  TRAVEL_OPTIONS,
  VENUE_OPTIONS,
  inOrder,
  type WeddingValues,
} from "@/lib/wedding"

const GROUP_LABEL = "text-[length:var(--text-label)] text-muted"

type YourWeddingProps = {
  initialValues?: WeddingValues
  onBack?: () => void
  onNext?: (values: WeddingValues) => void
}

// Step 3 of 4: Your wedding. Layout and copy follow wireframes 6.1 and 6.2 on the Doop canvas.
export function YourWeddingScreen({ initialValues = EMPTY_WEDDING, onBack, onNext }: YourWeddingProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<WeddingValues>(initialValues)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onNext?.(values)
      }}
      className="grid w-[720px] max-w-full content-start gap-6"
    >
      <p className="text-[length:var(--text-label)] text-muted">{t("wedding.step")}</p>
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("wedding.title")}</h2>

      <div className="grid gap-2.5">
        <span className={GROUP_LABEL}>{t("wedding.styles")}</span>
        <ToggleGroup
          type="multiple"
          value={values.styles}
          onValueChange={(next) => setValues((current) => ({ ...current, styles: inOrder(STYLE_OPTIONS, next) }))}
          aria-label={t("wedding.styles")}
          className={CHIP_GROUP_CLASS}
        >
          {STYLE_OPTIONS.map((style) => (
            <ToggleGroupItem key={style} value={style} className={CHIP_ITEM_CLASS}>
              {t(`style.${style}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2.5">
        <span className={GROUP_LABEL}>{t("wedding.dietary")}</span>
        <ToggleGroup
          type="multiple"
          value={values.dietary}
          onValueChange={(next) =>
            setValues((current) => ({
              ...current,
              dietary: inOrder(
                DIETARY_OPTIONS.map((option) => option.value),
                next
              ),
            }))
          }
          aria-label={t("wedding.dietary")}
          className={CHIP_GROUP_CLASS}
        >
          {DIETARY_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className={CHIP_ITEM_CLASS}>
              {t(`dietary.${option.value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2.5">
        <span className={GROUP_LABEL}>{t("wedding.venue")}</span>
        <ToggleGroup
          type="single"
          value={values.venueSetting}
          onValueChange={(next) =>
            // Radix sends "" when the chosen chip is clicked again. Clearing the choice is allowed.
            setValues((current) => ({ ...current, venueSetting: next as WeddingValues["venueSetting"] }))
          }
          aria-label={t("wedding.venue")}
          className={CHIP_GROUP_CLASS}
        >
          {VENUE_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className={CHIP_ITEM_CLASS}>
              {t(`venueSetting.${option.value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2.5">
        <span className={GROUP_LABEL}>{t("wedding.travel")}</span>
        <ToggleGroup
          type="single"
          value={values.maxTravelMinutes === null ? "" : String(values.maxTravelMinutes)}
          onValueChange={(next) =>
            setValues((current) => ({
              ...current,
              maxTravelMinutes: next ? (Number(next) as WeddingValues["maxTravelMinutes"]) : null,
            }))
          }
          aria-label={t("wedding.travel")}
          className={CHIP_GROUP_CLASS}
        >
          {TRAVEL_OPTIONS.map((minutes) => (
            <ToggleGroupItem key={minutes} value={String(minutes)} className={CHIP_ITEM_CLASS}>
              {t("wedding.minutes", { count: minutes })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2.5">
        <label htmlFor="traditions" className={GROUP_LABEL}>
          {t("wedding.traditions")}
        </label>
        <Textarea
          id="traditions"
          placeholder={t("wedding.traditionsPlaceholder")}
          maxLength={TRADITIONS_MAX}
          value={values.traditions}
          onChange={(event) => setValues((current) => ({ ...current, traditions: event.target.value }))}
          className="min-h-24 rounded-md border-muted bg-surface px-4 py-2.5 font-body text-[length:var(--text-body)] text-ink shadow-none focus-visible:border-2 focus-visible:border-accent focus-visible:ring-0"
        />
      </div>

      <div className="mt-3 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button type="submit">{t("common.next")}</Button>
      </div>
    </form>
  )
}
