import rawCurriculumId from "@/data/lancar-ngoding-curriculum.json";
import rawCurriculumEn from "@/data/lancar-ngoding-curriculum-en.json";
import { type Language } from "@/lib/i18n/types";
import { type LessonItem } from "@/components/LancarNgoding/StepLearnView";

export function getCurriculum(lang: Language): LessonItem[] {
  return (lang === "en" ? rawCurriculumEn : rawCurriculumId) as LessonItem[];
}
