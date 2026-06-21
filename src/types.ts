export type SkinSignal =
  | "dry" | "normal" | "combination" | "oily"
  | "sensitive" | "somewhat" | "resilient"
  | "age";

export interface QuestionOption {
  id: string;
  label: string;
  desc?: string;
  signal?: SkinSignal;
  photo?: string;
  age?: AgeId;
  preg?: PregnancyId;
}

export interface Question {
  id: string;
  topic: string;
  eyebrow: string;
  title: string;
  help: string;
  photoHint?: boolean;
  noPhoto?: boolean;
  optional?: boolean;
  options: QuestionOption[];
}

export type AgeId = "under20" | "20s" | "30s" | "40s" | "50plus";
export type PregnancyId = "no" | "pregnant" | "planning" | "breastfeeding";

export interface Concern {
  id: string;
  label: string;
  desc: string;
  photo: string;
}

export interface Goal {
  id: string;
  label: string;
  desc: string;
}

export interface OptionLevel {
  id: string;
  label: string;
  desc: string;
  meta: string;
  region?: RegionId;
}

export type RegionId = "asia" | "us" | "eu" | "none";

export type AnswerStyle = "photos" | "cards" | "list";

export interface Active {
  id: string;
  name: string;
  aka: string;
  type: string;
  what: string;
  why: string;
  for: string[];
  gentle: boolean;
  avoidInPregnancy?: boolean;
}

export interface ScoredActive {
  active: Active;
  score: number;
  reasons: string[];
}

export interface Product {
  region: Exclude<RegionId, "none">;
  tier: "Budget" | "Mid" | "Premium";
  brand: string;
  name: string;
  price: string;
}

export interface Meter {
  key: string;
  label: string;
  level: number;
  value: string;
}

export interface Analysis {
  type: "dry" | "normal" | "combination" | "oily";
  typeLabel: string;
  sensitivity: "high" | "moderate" | "low";
  headline: string;
  subhead: string;
  meters: Meter[];
  paragraphs: string[];
  needs: string[];
}

export interface Profile {
  type: Analysis["type"];
  typeLabel: string;
  sensitivity: Analysis["sensitivity"];
  age: AgeId | null;
  pregnancy: PregnancyId | null;
  concernIds: string[];
  topConcerns: string[];
  topConcernLabels: string[];
  topConcernLabel: string | null;
  concernCount: number;
  goalIds: string[];
  commitment: string | null;
  commitmentLabel: string | null;
  region: RegionId;
  regionLabel: string | null;
}

export interface RoutineStep {
  type: string;
  active: string | null;
  note: string;
  spf?: boolean;
}

export interface Routine {
  am: RoutineStep[];
  pm: RoutineStep[];
  notes: string[];
}
