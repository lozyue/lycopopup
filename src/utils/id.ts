let lycoIdSeed = 0;

export function createLycoId(prefix = "lyco-popup"): string {
  lycoIdSeed = (lycoIdSeed + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${Date.now().toString(36)}-${lycoIdSeed.toString(36)}`;
}
