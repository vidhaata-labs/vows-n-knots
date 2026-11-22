import { useState } from "react"

import { AppShell } from "@/components/app/app-shell"
import type { AboutYouValues } from "@/lib/about-you-schema"
import type { BudgetValues } from "@/lib/budget"
import { buildPlanRequest, type PlanRequestBody } from "@/lib/plan-request"
import type { PlanData } from "@/lib/plan-stream"
import { useLeaveWarning } from "@/lib/use-leave-warning"
import { usePlanBuild } from "@/lib/use-plan-build"
import type { WeddingValues } from "@/lib/wedding"
import { AboutYouScreen, EMPTY_ABOUT_YOU } from "@/screens/about-you"
import { BudgetPrioritiesScreen } from "@/screens/budget-and-priorities"
import { BuildingScreen } from "@/screens/building"
import { ReviewScreen } from "@/screens/review"
import { WelcomeScreen } from "@/screens/welcome"
import { YourPlanScreen } from "@/screens/your-plan"
import { YourWeddingScreen } from "@/screens/your-wedding"

// Wireframe sample values (4.1, 5.1 and 6.1). The first screens open with the sample couple filled in.
const SAMPLE_ABOUT_YOU: AboutYouValues = {
  ...EMPTY_ABOUT_YOU,
  coupleNames: "Amira & Noah",
  state: "IL",
  city: "Chicago",
  cityId: "1714000",
  dateMode: "exact",
  exactDate: new Date(2027, 6, 18),
  guestCount: 120,
  currency: "USD",
}

const SAMPLE_BUDGET: BudgetValues = {
  budgetLow: 35000,
  budgetHigh: 65000,
  priorities: ["Venue shortlist", "Vendor research", "Budget allocation"],
}

const SAMPLE_WEDDING: WeddingValues = {
  styles: ["Modern", "Romantic", "Garden"],
  dietary: ["vegetarian"],
  venueSetting: "Indoor-outdoor",
  maxTravelMinutes: 45,
  traditions: "Short western ceremony, then a family tea ceremony.",
}

type Step = "welcome" | "about" | "budget" | "wedding" | "review" | "building" | "plan"

export default function App() {
  const [step, setStep] = useState<Step>("welcome")
  const [about, setAbout] = useState<AboutYouValues>(SAMPLE_ABOUT_YOU)
  const [budget, setBudget] = useState<BudgetValues>(SAMPLE_BUDGET)
  const [wedding, setWedding] = useState<WeddingValues>(SAMPLE_WEDDING)
  const [planRequest, setPlanRequest] = useState<PlanRequestBody | null>(null)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const build = usePlanBuild()

  // While a build runs, closing or reloading the tab asks the browser to confirm first.
  const running = step === "building" && (build.state.phase === "research" || build.state.phase === "writing")
  useLeaveWarning(running)

  // Called by the build when the plan arrives. The build is started from a click, not an effect.
  const showPlan = (finished: PlanData) => {
    setPlan(finished)
    setStep("plan")
  }

  return (
    <AppShell>
      {step === "welcome" ? <WelcomeScreen onStart={() => setStep("about")} /> : null}
      {step === "about" ? (
        <AboutYouScreen
          initialValues={about}
          onBack={() => setStep("welcome")}
          onNext={(values) => {
            setAbout(values)
            setStep("budget")
          }}
        />
      ) : null}
      {step === "budget" ? (
        <BudgetPrioritiesScreen
          guestCount={about.guestCount}
          currency={about.currency}
          initialValues={budget}
          onBack={() => setStep("about")}
          onNext={(values) => {
            setBudget(values)
            setStep("wedding")
          }}
        />
      ) : null}
      {step === "wedding" ? (
        <YourWeddingScreen
          initialValues={wedding}
          onBack={() => setStep("budget")}
          onNext={(values) => {
            setWedding(values)
            setStep("review")
          }}
        />
      ) : null}
      {step === "review" ? (
        <ReviewScreen
          about={about}
          budget={budget}
          wedding={wedding}
          onEdit={(target) => setStep(target)}
          onBuild={() => {
            const request = buildPlanRequest(about, budget, wedding, about.state, about.city)
            if (!request) return
            setPlanRequest(request)
            // Show the building screen before starting, so a build that finishes at once still ends on the plan.
            setStep("building")
            build.start(request, showPlan)
          }}
        />
      ) : null}
      {step === "building" && planRequest ? (
        <BuildingScreen
          state={build.state}
          priorities={planRequest.priorities}
          onRetry={() => build.start(planRequest, showPlan)}
          onStop={() => {
            build.stop()
            setStep("review")
          }}
        />
      ) : null}
      {step === "plan" && plan ? (
        <YourPlanScreen
          plan={plan}
          about={about}
          budget={budget}
          wedding={wedding}
          onStartAgain={() => {
            setPlan(null)
            setStep("welcome")
          }}
        />
      ) : null}
    </AppShell>
  )
}
