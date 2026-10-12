/** Preserve list data only while the resource and its entity IDs stay the same. */
export function keepPreviousForEntity<T>(
  previous: T | undefined,
  previousKey: readonly unknown[] | undefined,
  identity: readonly unknown[],
): T | undefined {
  return previousKey && identity.every((value, index) => value === previousKey[index]) ? previous : undefined;
}
