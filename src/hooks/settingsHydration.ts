/**
 * Adopting the settings saved on disk without losing what the reader changed meanwhile (2.8.0).
 *
 * At launch the app starts on cached or default settings and replaces them with the durable copy
 * once the embedded server answers. A theme made in that window (the server still starting, or
 * the read retrying) used to vanish with the replacement, and the marks already filed under it
 * were left pointing at a theme that no longer existed: shown untagged, missing from the tracker.
 *
 * So the durable copy wins only where the reader has not changed anything since launch. Fields
 * changed in memory keep the reader's value; themes are merged by id, the disk's first.
 */

type Settings = Record<string, unknown> & { activeThemes?: { id: string }[] };

export function mergeHydratedSettings<T extends Settings>(remote: T, atLaunch: T, current: T): T {
  if (current === atLaunch) return remote;
  const out: Record<string, unknown> = { ...remote };
  for (const key of Object.keys(current)) {
    if (current[key] !== atLaunch[key]) out[key] = current[key];
  }
  if (current.activeThemes !== atLaunch.activeThemes) {
    const launched = new Set((atLaunch.activeThemes ?? []).map((t) => t.id));
    const kept = new Set((current.activeThemes ?? []).map((t) => t.id));
    // The disk's themes, less any the reader deleted this session, then the ones made this session.
    const fromDisk = (remote.activeThemes ?? []).filter((t) => kept.has(t.id) || !launched.has(t.id));
    const made = (current.activeThemes ?? []).filter((t) => !launched.has(t.id) && !fromDisk.some((d) => d.id === t.id));
    // A theme renamed or recoloured this session keeps its new look.
    const byId = new Map((current.activeThemes ?? []).map((t) => [t.id, t]));
    out.activeThemes = [...fromDisk.map((t) => (launched.has(t.id) && byId.has(t.id) ? byId.get(t.id)! : t)), ...made];
  }
  return out as T;
}
