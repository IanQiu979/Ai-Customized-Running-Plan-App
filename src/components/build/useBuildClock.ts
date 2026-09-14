import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * One master clock for a build animation: a shared value `T` in SECONDS that runs linearly from
 * 0 to `total` once, then holds. Every build component (`lib/buildMotion.ts`) derives its state
 * from `T` on the UI thread, exactly as the approved V22 pages derive theirs from the page's
 * timeline, so the choreography is one number and not a tree of chained timers.
 *
 * Reduced motion: the clock starts AT `total` and never runs — the end frame is shown directly
 * (spec §0: "every page has a static end frame that stands alone"). `settled` is true on mount.
 *
 * `settled` flips when the clock reaches `total`, and never later than `total + slack` even if
 * the animation callback is lost (a backgrounded app, dropped cold-start frames): a caller that
 * gates a control on it can never be stranded.
 *
 * `play` false holds the clock at 0 — for a step piece waiting to scroll into view — and the
 * run starts the first time it turns true. It never re-runs on its own (no loops on heroes);
 * `restart()` is the one way to play again, for a screen whose data changed.
 */
export function useBuildClock({
  total,
  play = true,
}: {
  total: number;
  play?: boolean;
}): { T: SharedValue<number>; settled: boolean; restart: () => void } {
  const reduceMotion = useReducedMotion();
  const T = useSharedValue(reduceMotion ? total : 0);
  const [settled, setSettled] = useState(reduceMotion);
  const [run, setRun] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    // Under reduced motion the clock was initialised at `total` and `settled` at true; there is
    // nothing to run.
    if (!play || reduceMotion) return;
    started.current = true;
    T.value = 0;
    T.value = withTiming(
      total,
      { duration: total * 1000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(setSettled)(true);
      }
    );
    const ceiling = setTimeout(() => setSettled(true), total * 1000 + SETTLE_SLACK_MS);
    return () => {
      clearTimeout(ceiling);
      cancelAnimation(T);
    };
    // `T` is a stable shared-value handle; `run` re-fires the effect on `restart()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, total, reduceMotion, run]);

  const restart = useCallback(() => {
    if (reduceMotion || !started.current) return;
    setSettled(false);
    setRun((n) => n + 1);
  }, [reduceMotion]);

  return { T, settled, restart };
}

/** Slack past the authored end before `settled` is forced, in ms. */
export const SETTLE_SLACK_MS = 400;
