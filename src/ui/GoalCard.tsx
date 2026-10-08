// The prototype's connection goal: a target, and how close the event is to it.
// The goal is the person's own number, kept on this device; the progress is
// the funnel's Goal step from Mole, never an estimate.

import { CheckCircle2, Target } from 'lucide-react';
import { formatCount } from '../domain/format.ts';
import type { Stage } from '../domain/funnel.ts';

export function GoalCard({ stage, goal }: { stage: Stage | undefined; goal: number }) {
  if (!stage) return null;
  const value = stage.value;
  const met = value != null && goal > 0 && value >= goal;
  const pct = value == null || goal <= 0 ? 0 : Math.min(100, (value / goal) * 100);

  return (
    <section
      className={`relative overflow-hidden rounded-card border p-6 shadow-subtle transition-colors duration-slow
        ${met ? 'border-ok-border bg-ok-tint' : 'border-line bg-surface'}`}
      aria-label="Connection goal"
    >
      <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className={`rounded-panel p-3 ${met ? 'bg-surface text-ok-text' : 'bg-surface-3 text-purple-text'}`}>
            {met ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <Target className="h-6 w-6" aria-hidden />}
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">Connection goal</h2>
            <p className="text-sm text-fg-muted">
              {value == null
                ? stage.missing
                : met
                  ? `Goal reached: ${stage.label.toLowerCase()}. Great work.`
                  : `${formatCount(goal - value)} more to reach your goal.`}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-5 md:w-auto">
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className={`text-3xl font-extrabold tabular-nums ${met ? 'text-ok-text' : 'text-ink'}`}>
                {value == null ? '—' : formatCount(value)}
              </span>
              <span className="font-semibold text-fg-subtle">/ {formatCount(goal)}</span>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-fg-subtle">{stage.label}</span>
          </div>
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3 md:w-36 md:flex-none"
            role="progressbar"
            aria-label="Progress to the goal"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={value ?? 0}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-slow ease-enter ${met ? 'bg-ok' : 'bg-sunny'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
