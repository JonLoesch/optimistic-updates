/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function getOrCreate<K, V, Token = never>(
  map: Map<K, V>,
  key: K,
  create: () => V | Token
): V | Token {
  if (map.has(key)) return map.get(key)!;
  return map.set(key, create() as V).get(key)!;
}
