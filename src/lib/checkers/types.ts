export type RuleStatus = "pass" | "fail" | "warning";

export interface RuleResult {
  id: string;
  label: string;
  status: RuleStatus;
  message: string;
  reference: string;
}

export interface CheckReport {
  docType: "cong_van";
  score: number;
  passed: boolean;
  results: RuleResult[];
}
