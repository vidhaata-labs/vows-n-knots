import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppAlert } from "@/components/app/app-alert"
import { CategoryTile } from "@/components/app/category-tile"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  percentDone,
  tileName,
  tileText,
  tilesFor,
  timeLeftText,
  type BuildState,
} from "@/lib/building"

type BuildingProps = {
  state: BuildState
  priorities: readonly string[]
  onRetry: () => void
  onStop: () => void
}

// Building your plan, from wireframes 8.1 to 8.4 on the Doop canvas.
// The build itself is started and run by usePlanBuild in the app; this screen only shows its state.
export function BuildingScreen({ state, priorities, onRetry, onStop }: BuildingProps) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  // Refresh the time estimate once a second while searches run.
  useEffect(() => {
    if (state.phase !== "research") return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  if (state.phase === "failed") {
    return (
      <div className="grid w-[960px] max-w-full content-start gap-6">
        <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("building.failedTitle")}</h2>
        <AppAlert>{t("building.failedAlert")}</AppAlert>
        <TileGrid priorities={priorities} state={state} />
        <div className="flex justify-end">
          <Button type="button" onClick={onRetry}>
            {t("building.tryAgain")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid w-[960px] max-w-full content-start gap-6">
      <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{t("building.title")}</h2>

      <div className="grid gap-2">
        <div className="flex justify-between text-[length:var(--text-label)] text-ink">
          <span>{timeLeftText(state, now)}</span>
          <span>{percentDone(state)}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface">
          <div
            className="h-2 rounded-full bg-accent transition-[width]"
            style={{ width: `${percentDone(state)}%` }}
          />
        </div>
        {/* Status for the bar: the build has to stay open, so the note sits with the progress. */}
        <p className="text-[length:var(--text-label)] text-muted">{t("building.keepOpen")}</p>
      </div>

      <TileGrid priorities={priorities} state={state} />

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost">
              {t("building.stop")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("building.stopTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("building.stopDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("building.keepBuilding")}</AlertDialogCancel>
              <AlertDialogAction onClick={onStop}>{t("building.stopConfirm")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// One tile per chosen section, in the order of the research plan.
function TileGrid({ priorities, state }: { priorities: readonly string[]; state: BuildState }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {tilesFor(priorities).map((tile) => {
        const progress = state.tiles[tile.key]
        const text = tileText(progress)
        // Every search for the tile failed: decided from the counts, so it holds in any language.
        const noFigures = Boolean(
          progress && progress.finished === progress.total && progress.failed === progress.total
        )
        return (
          <CategoryTile
            key={tile.key}
            name={tileName(tile.key)}
            icon={tile.icon}
            text={text}
            searching={Boolean(progress && progress.started > progress.finished)}
            noFigures={noFigures}
          />
        )
      })}
    </div>
  )
}
