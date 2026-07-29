"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveToPipeline(title: string, content: unknown, generationId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .insert({
      user_id: user.id,
      title,
      content: content as any,
      status: "ide",
      generation_id: generationId || null,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app");
  return data;
}

export async function updateCardStatus(cardId: string, newStatus: "ide" | "draft" | "siap" | "posted") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .update({ status: newStatus })
    .eq("id", cardId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app");
  return data;
}

export async function updateCardContentAndStatus(cardId: string, newContent: unknown, newStatus: "ide" | "draft" | "siap" | "posted") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .update({ content: newContent as any, status: newStatus })
    .eq("id", cardId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app");
  return data;
}

/**
 * Rate a generation directly, without going through a pipeline card.
 *
 * Ratings feed `LearnedNote[]` in the prompt context, so this is the only way a
 * creator teaches the model what works for them. Locking it behind "save to
 * pipeline → post it → rate it" meant almost nothing ever got rated, which is
 * why the feedback loop had no data to run on.
 */
export async function rateGeneration(generationId: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating harus 1 sampai 5.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Scoped to the owner: without the user_id filter this would let anyone
  // rate anyone's generation and poison their prompt context.
  const { error } = await supabase
    .from("generations")
    .update({ performance_rating: rating })
    .eq("id", generationId)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/app");
}

export async function ratePerformance(cardId: string, rating: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: card, error: fetchError } = await supabase
    .from("pipeline_cards")
    .select("generation_id")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !card) throw fetchError || new Error("Card not found");

  if (card.generation_id) {
    const { error: genError } = await supabase
      .from("generations")
      .update({ performance_rating: rating })
      .eq("id", card.generation_id)
      .eq("user_id", user.id);

    if (genError) throw genError;
  }
  
  revalidatePath("/app");
}
