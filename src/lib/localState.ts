import type { AppState } from "../types";

const KEY = "clientsflow_mvp_state";

const defaultState: AppState = {
  checkout: {
    selectedPlanId: "trial",
    isPaid: false,
    activatedAt: null
  },
  onboardingCompleted: false,
  onboardingData: {
    businessName: "",
    niche: "",
    primaryChannel: "",
    averageLeadsPerMonth: 120
  }
};

export function loadAppState(): AppState {
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...defaultState,
      ...parsed,
      checkout: { ...defaultState.checkout, ...parsed.checkout },
      onboardingData: { ...defaultState.onboardingData, ...parsed.onboardingData }
    };
  } catch {
    return defaultState;
  }
}

export function saveAppState(nextState: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(nextState));
}
