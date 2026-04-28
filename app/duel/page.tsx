import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import DuelLobby from "@/components/DuelLobby";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function DuelPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex-1 px-4">
        <DuelLobby user={user} />
      </div>
    </main>
  );
}
