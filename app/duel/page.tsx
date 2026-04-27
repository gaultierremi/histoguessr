import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import DuelLobby from "@/components/DuelLobby";

export const dynamic = "force-dynamic";

export default async function DuelPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return (
    <main className="min-h-screen bg-gray-950 px-4">
      <DuelLobby user={user} />
    </main>
  );
}
