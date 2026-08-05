import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/translations";
import PrintClient from "./print-client";

/**
 * Print-ready rendering of the whole directory. Admin-gated exactly as
 * /admin is: the proxy lets the path through, this server component decides.
 */
export default async function DirectoryPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login?error=not_admin");

  const { lang } = await searchParams;
  const edition: Lang = lang === "en" ? "en" : "hi";

  return <PrintClient edition={edition} />;
}
