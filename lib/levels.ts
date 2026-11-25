export const levels = ['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'] as const;
export type Level = (typeof levels)[number];

export function isLevel(value: unknown): value is Level {
  return levels.some((level) => level === value);
}

export function detectLevel(metadata: string[], filename: string): Level | null {
  for (const value of [...metadata, filename.replace(/\.[^.]+$/, '')]) {
    const code = value.match(/(?:^|[^a-z0-9])([abc][12]\+?)(?![a-z0-9+])/i)?.[1]?.toUpperCase();
    if (isLevel(code)) return code;
  }
  return null;
}
