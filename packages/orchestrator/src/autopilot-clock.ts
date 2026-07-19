interface AutopilotClockState {
  activeMilliseconds?: number;
  activeSince?: string;
}

function timestampMilliseconds(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function autopilotActiveMilliseconds(
  state: AutopilotClockState,
  at = Date.now()
): number {
  const accumulated = Math.max(0, state.activeMilliseconds ?? 0);
  const activeSince = timestampMilliseconds(state.activeSince);
  return activeSince === null
    ? accumulated
    : accumulated + Math.max(0, at - activeSince);
}

export function resumeAutopilotClock(
  state: AutopilotClockState,
  timestamp: string
): { activeMilliseconds: number; activeSince: string } {
  return {
    activeMilliseconds: Math.max(0, state.activeMilliseconds ?? 0),
    activeSince: timestamp
  };
}

export function pauseAutopilotClock(
  state: AutopilotClockState,
  timestamp: string
): { activeMilliseconds: number; activeSince: undefined } {
  const at = timestampMilliseconds(timestamp) ?? Date.now();
  return {
    activeMilliseconds: autopilotActiveMilliseconds(state, at),
    activeSince: undefined
  };
}
