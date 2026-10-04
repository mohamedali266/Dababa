import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
let password = process.env.ADMIN_INITIAL_PASSWORD;

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from({ length: 28 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function main() {
  if (process.env.ADMIN_SEED_CONFIRM !== "yes") throw new Error("Refusing to run: set ADMIN_SEED_CONFIRM=yes.");
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase server environment.");
  if (!email) throw new Error("Missing ADMIN_EMAIL.");
  if (!password) {
    password = randomPassword();
    console.log(`Generated one-time admin password: ${password}`);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = existing.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Platform Admin", must_change_password: true } });
    if (created.error) throw created.error;
    user = created.data.user;
  } else {
    const updated = await supabase.auth.admin.updateUserById(user.id, { password, user_metadata: { ...(user.user_metadata ?? {}), must_change_password: true } });
    if (updated.error) throw updated.error;
  }

  const { error } = await supabase.from("platform_admins").upsert({ user_id: user.id, status: "active" }, { onConflict: "user_id" });
  if (error) throw error;
  console.log(`Seeded admin: ${email.replace(/(.{2}).+(@.+)/, "$1***$2")}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
