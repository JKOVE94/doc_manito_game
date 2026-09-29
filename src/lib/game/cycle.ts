export interface CycleLink<T> { giver: T; receiver: T; position: number }
export function buildSingleCycle<T>(ids: readonly T[], random: () => number = Math.random): CycleLink<T>[] {
  if (ids.length < 4) throw new Error("최소 4명 이상이어야 합니다.");
  if (new Set(ids).size !== ids.length) throw new Error("중복된 참가자가 있습니다.");

  const order: T[] = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order.map((giver, index) => ({
    giver,
    receiver: order[(index + 1) % order.length],
    position: index
  }));
}
