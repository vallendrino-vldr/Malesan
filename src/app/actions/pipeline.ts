"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { revalidatePath } from "next/cache";

/**
 * `status` is a parameter now, not always "ide".
 *
 * A hook that has already been generated is not an idea waiting for a hook —
 * it belongs in Draft with the Script action unlocked. A finished script
 * belongs in Siap. Forcing everything to "ide" made a saved script show
 * "Langkah 1 dari 3 — bikin hook dulu" over work that was already done.
 */
export async function saveToPipeline(
  title: string,
  content: unknown,
  generationId?: string,
  status: "ide" | "draft" | "siap" | "posted" = "ide",
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .insert({
      user_id: user.id,
      title,
      content: content as Json,
      status,
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
    .update({ content: newContent as Json, status: newStatus })
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

/**
 * Delete one generation from history.
 *
 * History was read-only, so a bad or embarrassing result sat there forever and
 * the list turned into clutter the user could not clean. Scoped to the owner:
 * without the `user_id` filter this would let anyone delete anyone's history.
 *
 * A deleted generation also stops feeding `LearnedNote[]`, which is the point —
 * removing a result is how a creator says "don't learn from this".
 */
export async function deleteGeneration(generationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("generations")
    .delete()
    .eq("id", generationId)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/app");
}

/**
 * Remove a card from the pipeline.
 *
 * The board had no way out. A card that turned out to be a bad idea, a
 * duplicate, or a test could be moved between the four stages forever but never
 * removed, so the board filled with things nobody intended to make and the
 * counts on the stage tabs stopped meaning anything. "Posted" was the only exit
 * and it is a lie for an idea that was never posted.
 *
 * Scoped to the owner. The row is returned so the caller can offer an undo —
 * see `restorePipelineCard`.
 */
export async function deletePipelineCard(cardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", user.id)
    .select()
    .single();

  // `.single()` on a delete that matched nothing throws PGRST116. That is the
  // honest outcome: nothing was deleted, so the UI must not claim it was.
  if (error) throw error;

  revalidatePath("/app");
  return data;
}

/**
 * Put a deleted card back exactly as it was.
 *
 * Deliberately a real re-insert of the original row rather than a delayed
 * delete on a timer. A pending delete that only fires when a toast expires is
 * lost the moment the tab closes, which means the card silently comes back —
 * the worst of both behaviours. This way the delete is real immediately and the
 * undo is a real write too, so whatever the screen says is what the database
 * holds.
 *
 * The original `id` is kept so the card returns to the same place in the
 * ordering and any `generation_id` link survives.
 */
export async function restorePipelineCard(card: {
  id: string;
  title: string;
  content: Json;
  status: "ide" | "draft" | "siap" | "posted";
  generation_id: string | null;
  created_at: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pipeline_cards")
    .insert({
      id: card.id,
      user_id: user.id,
      title: card.title,
      content: card.content,
      status: card.status,
      generation_id: card.generation_id,
      created_at: card.created_at,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app");
  return data;
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
