import { SupabaseClient } from "@supabase/supabase-js";

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function createRoom(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
  difficulty: number
) {
  const code = generateCode();

  const { data, error } = await supabase
    .from("multiplayer_rooms")
    .insert({
      code,
      host_id: userId,
      host_name: userName,
      difficulty,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("multiplayer_participants").insert({
    room_id: data.id,
    user_id: userId,
    user_name: userName,
    is_host: true,
  });

  return data;
}

export async function joinRoom(
  supabase: SupabaseClient,
  code: string,
  userId: string,
  userName: string
) {
  const { data: room } = await supabase
    .from("multiplayer_rooms")
    .select("*")
    .eq("code", code)
    .single();

  if (!room) throw new Error("Salon introuvable");

  const { count } = await supabase
    .from("multiplayer_participants")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= room.max_players) {
    throw new Error("Salon plein");
  }

  await supabase.from("multiplayer_participants").insert({
    room_id: room.id,
    user_id: userId,
    user_name: userName,
  });

  return room;
}

export async function startRoom(
  supabase: SupabaseClient,
  roomId: string,
  questionIds: string[]
) {
  const { error } = await supabase
    .from("multiplayer_rooms")
    .update({
      status: "playing",
      question_ids: questionIds,
      started_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (error) throw error;
}