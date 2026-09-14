import { useEffect, useState } from 'react';

import { API_BASE_URL, describeError, getPlan } from '@/lib/apiClient';
import { EXAMPLE_PLAN_ID, examplePlan } from '@/lib/fixtures/examplePlan';
import type { Plan } from '@/lib/planTypes';

/**
 * One plan, fetched once and shared by the plan-detail screens (V22-06 A → B → C/D are three
 * pushes over the same immutable plan) and by the tabs that draw a plan's first week (My Plans'
 * hero and rows, Home's header mark). A plan never changes after generation, so a session-long
 * in-memory cache is correct, not merely convenient: the second and third screens of a push
 * chain open instantly and never refetch.
 *
 * `EXAMPLE_PLAN_ID` resolves to the local fixture with no request — the captain's "never remove
 * the sample plan" call, kept reachable whatever the network does.
 */

export interface LoadedPlan {
  plan: Plan;
  /** Whether this specific plan consumed a quota slot. Always false for the example plan. */
  quotaConsumed: boolean;
}

const cache = new Map<string, LoadedPlan>();
const inflight = new Map<string, Promise<LoadedPlan>>();

/** The cached plan, if this session has already loaded it. Synchronous; never fetches. */
export function peekPlan(planId: string): LoadedPlan | undefined {
  if (planId === EXAMPLE_PLAN_ID) return { plan: examplePlan, quotaConsumed: false };
  return cache.get(planId);
}

/** Loads a plan through the cache. Concurrent callers share one request. */
export function loadPlan(planId: string): Promise<LoadedPlan> {
  const cached = peekPlan(planId);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(planId);
  if (pending) return pending;
  const request = getPlan(planId)
    .then((response) => {
      const loaded = { plan: response.plan, quotaConsumed: response.quotaConsumed };
      cache.set(planId, loaded);
      return loaded;
    })
    .finally(() => {
      inflight.delete(planId);
    });
  inflight.set(planId, request);
  return request;
}

/** Test seam only: forget everything loaded so far. */
export function clearPlanCache(): void {
  cache.clear();
  inflight.clear();
}

export interface PlanState {
  loaded: LoadedPlan | null;
  loading: boolean;
  error: string | null;
}

/**
 * The plan for a route's `[id]` param. `undefined`/empty ids resolve to a not-found error
 * without a request. Cached plans render on the first frame.
 */
export function usePlan(planId: string | undefined): PlanState {
  const [state, setState] = useState<PlanState>(() => {
    const cached = planId ? peekPlan(planId) : undefined;
    return cached
      ? { loaded: cached, loading: false, error: null }
      : { loaded: null, loading: Boolean(planId), error: planId ? null : NOT_FOUND };
  });

  useEffect(() => {
    if (!planId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronising with the route param
      setState({ loaded: null, loading: false, error: NOT_FOUND });
      return;
    }
    const cached = peekPlan(planId);
    if (cached) {
      setState({ loaded: cached, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ loaded: null, loading: true, error: null });
    loadPlan(planId)
      .then((loaded) => {
        if (!cancelled) setState({ loaded, loading: false, error: null });
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setState({
            loaded: null,
            loading: false,
            error: describeError(fetchError, 'Could not load this plan.', API_BASE_URL),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return state;
}

const NOT_FOUND = 'This plan could not be found.';
