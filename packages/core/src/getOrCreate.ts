export function getOrCreate<K, V, Token = never>(
  map: Map<K, V>,
  key: K,
  create: () => V | Token,
  typecheck?: (x: V | Token) => x is Token
): V | Token {
  if (map.has(key)) return map.get(key)!;
  const newObject = create();
  if (typecheck?.(newObject)) {
    return newObject;
  } else {
    return map.set(key, newObject as V).get(key)!;
  }
}
