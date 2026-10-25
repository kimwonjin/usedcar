// 판매 결정 기한: 경매 종료 후 24시간 (DB process_decision_deadlines와 같은 값)
export const DECISION_HOURS = 24;

export function decisionDeadline(endsAt: string): string {
  return new Date(new Date(endsAt).getTime() + DECISION_HOURS * 60 * 60 * 1000).toISOString();
}
