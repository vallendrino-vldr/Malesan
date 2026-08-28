import roleplayData from "@/data/roleplay_scenarios.json";

export interface ResponseOption {
  id: string;
  strategy: string;
  tone: string;
  script: string;
  risk: "low" | "medium" | "high";
  predicted_reaction: string;
  why_it_works: string;
}

export interface DiplomacyInsight {
  core_principle: string;
  psychology: string;
  indonesian_pitfall: string;
  power_phrases: string[];
  never_say: string[];
}

export interface VocabFocus {
  term: string;
  meaning_id: string;
}

export interface GlobalScenario {
  id: string;
  category: "price_negotiation" | "client_complaint" | "sv_interview" | "sponsorship_pitch";
  title: string;
  difficulty: number;
  channel: string;
  tags: string[];
  setting: {
    user_role: string;
    context_id: string;
    stakes_usd?: number;
    hidden_client_motivation: string;
  };
  ai_persona: {
    name: string;
    role: string;
    company: string;
    origin: string;
    temperament: string;
    pressure_tactic: string;
    walk_away_point: string;
  };
  ai_opening_line: string;
  response_options: ResponseOption[];
  diplomacy_insight: DiplomacyInsight;
  ai_followups: {
    if_user_holds_frame: string;
    if_user_folds: string;
    if_user_gets_defensive: string;
  };
  success_criteria: string[];
  vocab_focus: VocabFocus[];
}

export interface ScenarioCategoryMeta {
  key: string;
  label_id: string;
  count: number;
  icon: string;
  description: string;
}

export const SCENARIO_CATEGORIES: ScenarioCategoryMeta[] = [
  {
    key: "all",
    label_id: "Semua Skenario (20)",
    count: 20,
    icon: "globe",
    description: "Seluruh bank latihan skenario profesional global",
  },
  {
    key: "price_negotiation",
    label_id: "Negosiasi Harga ($3k-$10k)",
    count: 5,
    icon: "dollar",
    description: "Pertahankan rate tinggi, tolak diskon murahan, tangkal scope creep",
  },
  {
    key: "client_complaint",
    label_id: "Komplain Klien Krisis",
    count: 5,
    icon: "shield",
    description: "Hadapi klien galak, ancaman refund, dan perbedaan zona waktu secara diplomatis",
  },
  {
    key: "sv_interview",
    label_id: "Interview Silicon Valley (STAR)",
    count: 5,
    icon: "briefcase",
    description: "Lolos wawancara kerja remote US Tech Company dengan metode STAR",
  },
  {
    key: "sponsorship_pitch",
    label_id: "Pitching Sponsor Brand Global",
    count: 5,
    icon: "mic",
    description: "Amankan kontrak sponsor brand internasional untuk kreator konten",
  },
];

export const GLOBAL_SCENARIOS: GlobalScenario[] = roleplayData.scenarios as GlobalScenario[];

export function getScenarioById(id: string): GlobalScenario | undefined {
  return GLOBAL_SCENARIOS.find((s) => s.id === id || s.id.toLowerCase() === id.toLowerCase());
}

export function getScenariosByCategory(cat: string): GlobalScenario[] {
  if (!cat || cat === "all") return GLOBAL_SCENARIOS;
  return GLOBAL_SCENARIOS.filter((s) => s.category === cat);
}
