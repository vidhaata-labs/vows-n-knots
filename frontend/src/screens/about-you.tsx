import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { CityPicker, filterCities } from "@/components/app/city-picker"
import { ExactDatePicker } from "@/components/app/exact-date-picker"
import { MonthPicker } from "@/components/app/month-picker"
import { CONTROL, CONTROL_INVALID, Field } from "@/components/app/field"
import { Segmented } from "@/components/app/segmented"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchCities, fetchStates, type CityOption, type StateOption } from "@/lib/api"
import {
  CURRENCIES,
  GUEST_MAX,
  GUEST_MIN,
  makeAboutYouSchema,
  type AboutYouValues,
} from "@/lib/about-you-schema"
import { cn } from "@/lib/utils"

export const EMPTY_ABOUT_YOU: AboutYouValues = {
  coupleNames: "",
  state: "",
  city: "",
  cityId: "",
  dateMode: "exact",
  exactDate: undefined,
  month: "",
  guestCount: NaN,
  currency: "USD",
}

type AboutYouProps = {
  initialValues?: AboutYouValues
  onBack?: () => void
  onNext?: (values: AboutYouValues) => void
}

// Step 1 of 4: About you. Layout and copy follow wireframes 4.1 to 4.8 on the Doop canvas.
export function AboutYouScreen({ initialValues = EMPTY_ABOUT_YOU, onBack, onNext }: AboutYouProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => makeAboutYouSchema(), [])
  const {
    control,
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<AboutYouValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })

  const [states, setStates] = useState<StateOption[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [cityQuery, setCityQuery] = useState(initialValues.city)
  const stateCode = watch("state")
  const dateMode = watch("dateMode")
  const cityId = watch("cityId")

  useEffect(() => {
    fetchStates().then(setStates).catch(() => setStates([]))
  }, [])

  useEffect(() => {
    if (!stateCode) {
      setCities([])
      return
    }
    fetchCities(stateCode).then(setCities).catch(() => setCities([]))
  }, [stateCode])

  const stateName = states.find((state) => state.code === stateCode)?.name ?? ""
  const noCityMatch = cityQuery.trim() !== "" && cityId === "" && filterCities(cities, cityQuery).length === 0
  // Copy from the wireframe (4.7): shown while typed text matches no city in the state.
  const cityError = noCityMatch ? t("about.noCityMatch", { state: stateName }) : errors.city?.message
  const dateError = errors.exactDate?.message ?? errors.month?.message

  function chooseState(code: string) {
    setValue("state", code, { shouldDirty: true })
    setValue("city", "")
    setValue("cityId", "")
    setCityQuery("")
    clearErrors("city")
  }

  function typeCity(query: string) {
    setCityQuery(query)
    // Typed text is never a city. Only a pick from the list sets the city.
    setValue("city", "")
    setValue("cityId", "")
    clearErrors("city")
  }

  function pickCity(city: CityOption) {
    setCityQuery(city.name)
    setValue("city", city.name)
    setValue("cityId", city.id)
    clearErrors("city")
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onNext?.(values))}
      className="grid w-[640px] max-w-full content-start gap-5"
    >
      <p className="text-[length:var(--text-label)] text-muted">{t("about.step")}</p>
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("about.title")}</h2>

      <Field label={t("about.couple")} htmlFor="couple-names" error={errors.coupleNames?.message}>
        <Input
          id="couple-names"
          placeholder={t("about.couplePlaceholder")}
          aria-invalid={Boolean(errors.coupleNames)}
          className={cn(CONTROL, errors.coupleNames && CONTROL_INVALID)}
          {...register("coupleNames")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-5 max-[640px]:grid-cols-1">
        <Field label={t("about.state")} htmlFor="state" error={errors.state?.message}>
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={chooseState}>
                <SelectTrigger
                  id="state"
                  aria-invalid={Boolean(errors.state)}
                  className={cn(CONTROL, "data-[size=default]:h-11", errors.state && CONTROL_INVALID)}
                >
                  <SelectValue placeholder={t("about.statePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label={t("about.city")} htmlFor="city" error={cityError}>
          <CityPicker
            id="city"
            cities={cities}
            query={cityQuery}
            onQueryChange={typeCity}
            selectedId={cityId}
            onPick={pickCity}
            invalid={Boolean(cityError)}
            disabled={!stateCode}
          />
        </Field>
      </div>

      <Field label={t("about.date")} error={dateError}>
        <div className="grid grid-cols-2 items-center gap-5 max-[640px]:grid-cols-1">
          <div className="flex h-11 items-center">
            <Controller
              control={control}
              name="dateMode"
              render={({ field }) => (
                <Segmented
                  ariaLabel={t("about.dateType")}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "exact", label: t("about.exactDate") },
                    { value: "month", label: t("about.monthOnly") },
                  ]}
                />
              )}
            />
          </div>
          {dateMode === "exact" ? (
            <Controller
              control={control}
              name="exactDate"
              render={({ field }) => (
                <ExactDatePicker
                  id="exact-date"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.exactDate)}
                />
              )}
            />
          ) : (
            <Controller
              control={control}
              name="month"
              render={({ field }) => (
                <MonthPicker
                  id="wedding-month"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.month)}
                />
              )}
            />
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-5 max-[640px]:grid-cols-1">
        <Field label={t("about.guests")} htmlFor="guest-count" error={errors.guestCount?.message}>
          <Input
            id="guest-count"
            type="number"
            inputMode="numeric"
            min={GUEST_MIN}
            max={GUEST_MAX}
            aria-invalid={Boolean(errors.guestCount)}
            className={cn(CONTROL, errors.guestCount && CONTROL_INVALID)}
            {...register("guestCount", { valueAsNumber: true })}
          />
        </Field>

        <Field label={t("about.currency")} htmlFor="currency">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="currency" className={cn(CONTROL, "data-[size=default]:h-11")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
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

