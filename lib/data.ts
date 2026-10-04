import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { HomeData, JoinPreview, OnboardingInput, Result } from "@/types/db";

type AssessmentAnswers = {
  body?: { weight_kg?: number | string | null; height_cm?: number | string | null; age?: number | string | null };
  training?: { training_days?: string[] | null; training_days_per_week?: number | string | null; workout_duration_minutes?: number | string | null; experience?: string | null; activity_level?: string | null };
  goal?: { type?: string | null; duration_weeks?: number | string | null };
};
type SupplementRow = { name: string; supplement_logs?: { id: string }[] | null };
type MembershipRow = { trainer?: { profiles?: { display_name?: string | null } | null } | null };

const genericAuthError = "تعذر إتمام العملية. تأكد من البيانات وحاول مرة أخرى.";
const genericJoinError = "الكود غير صحيح أو مستخدم أو منتهي. راجع ناديك.";
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });

export async function signInWithEmail(email: string, password: string): Promise<Result> {
  const supabase = createSupabaseBrowserClient();
  const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) return { ok: false, error: genericAuthError };
  return ok(undefined);
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<Result> {
  const supabase = createSupabaseBrowserClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("personal_signup_enabled")
    .eq("id", true)
    .maybeSingle();

  if (settings?.personal_signup_enabled === false) {
    return { ok: false, error: "التسجيل الشخصي متوقف حاليًا. استخدم كود النادي أو تواصل مع الإدارة." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { display_name: name.trim(), full_name: name.trim() } }
  });

  if (result.error) return { ok: false, error: genericAuthError };

  if (!result.data.session) {
    const signIn = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (signIn.error) return { ok: false, error: "تم إنشاء الحساب، لكن إعداد تأكيد البريد مفعل في Supabase. افتح البريد أو عطّل Email confirmations مؤقتًا من Authentication." };
  }

  return ok(undefined);
}

export async function signInWithGoogle(next = "/app", flow?: "onboarding"): Promise<Result> {
  const supabase = createSupabaseBrowserClient();
  const params = new URLSearchParams({ next });
  if (flow) params.set("flow", flow);
  const redirectTo = `${window.location.origin}/auth/callback?${params.toString()}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) return { ok: false, error: "تعذر بدء الدخول باستخدام Google." };
  return ok(undefined);
}

export async function getCurrentUserIdentity(): Promise<{ email: string | null; name: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return {
    email: user?.email ?? null,
    name: typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null
  };
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const identity = await getCurrentUserIdentity();
  return identity.email;
}

export async function completeOnboarding(input: OnboardingInput): Promise<Result> {
  const supabase = createSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) return { ok: false, error: "سجل الدخول أولًا لإكمال رحلة التسجيل." };

  const birthYear = new Date().getFullYear() - input.age;
  const profileUpdate = {
    display_name: input.name.trim(),
    full_name: input.name.trim(),
    gender: input.gender,
    birth_year: birthYear,
    birth_date: null,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    status: "active"
  };

  const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
  if (profileError) return { ok: false, error: "تعذر حفظ بياناتك الأساسية. حاول مرة أخرى." };

  const answers = {
    identity: {
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() || user.email || null,
      gender: input.gender,
      age: input.age
    },
    body: { age: input.age, height_cm: input.heightCm, weight_kg: input.weightKg },
    training: {
      activity_level: input.activityLevel,
      training_days: input.trainingDays,
      training_days_per_week: input.trainingDays.length,
      workout_duration_minutes: input.workoutDurationMinutes,
      experience: input.trainingExperience,
      injuries: input.injuries
    },
    goal: { type: input.goal, duration_weeks: input.goalDurationWeeks },
    club: { join_code_entered: Boolean(input.joinCode?.trim()) }
  };

  const { data: assessment, error: assessmentError } = await supabase.from("assessments").upsert({
    user_id: user.id,
    goal: input.goal,
    level: input.trainingExperience,
    training_days: input.trainingDays,
    injuries: input.injuries,
    answers,
    completed_at: new Date().toISOString()
  }, { onConflict: "user_id" }).select("id").maybeSingle();
  if (assessmentError) return { ok: false, error: "تعذر حفظ التقييم. حاول مرة أخرى." };

  await ensureSuggestedPlans(supabase, user.id, input, assessment?.id ?? null);

  if (input.joinCode?.trim()) {
    const joined = await redeemJoinCode(input.joinCode);
    if (!joined.ok) return joined;
  }

  return ok(undefined);
}

/** Anonymous-safe preview of a join code. Must be rate limited and return only these fields. */
export async function previewJoinCode(code: string): Promise<Result<JoinPreview>> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("preview_join_code", { raw_code: code });
  if (error || !data || !Array.isArray(data) || data.length === 0) return { ok: false, error: genericJoinError };

  const row = data[0] as { club_name: string; trainer_name: string | null; plan_days: number };
  return ok({ clubName: row.club_name, trainerName: row.trainer_name, planDays: row.plan_days });
}

/** Authenticated. Atomic server-side redemption (see BACKEND.md). */
export async function redeemJoinCode(code: string): Promise<Result> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("redeem_join_code", { raw_code: code });
  if (error) return { ok: false, error: genericJoinError };
  return ok(undefined);
}

export async function getHome(): Promise<HomeData> {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return emptyHome("لاعب");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [profile, assessment, memberships, water, nutrition, workouts, supplements, plans] = await Promise.all([
    supabase.from("profiles").select("display_name, full_name, weight_kg").eq("id", user.id).maybeSingle(),
    supabase.from("assessments").select("answers, goal, level, training_days, place, completed_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("memberships").select("id, role, status, clubs(name), trainer:trainer_membership_id(user_id, profiles(display_name))").eq("user_id", user.id).eq("role", "player").eq("status", "active"),
    supabase.from("water_logs").select("amount_ml").eq("user_id", user.id).gte("logged_at", today.toISOString()).lt("logged_at", tomorrow.toISOString()),
    supabase.from("nutrition_plans").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workout_logs").select("id, title, completed_at").eq("user_id", user.id).gte("workout_date", today.toISOString().slice(0, 10)).limit(20),
    supabase.from("supplement_plans").select("id, name, supplement_logs(id)").eq("user_id", user.id).limit(20),
    supabase.from("training_plans").select("id, title, plan").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const displayName = profile.data?.display_name ?? profile.data?.full_name ?? user.email?.split("@")[0] ?? "لاعب";
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const answers = (assessment.data?.answers ?? {}) as AssessmentAnswers;
  const weight = Number(profile.data?.weight_kg ?? answers.body?.weight_kg ?? 80);
  const waterGoal = Math.max(1800, Math.round((Number.isFinite(weight) ? weight : 80) * 35));
  const waterMl = (water.data ?? []).reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0);
  const sessionsGoal = Math.max(1, Number(answers.training?.training_days_per_week ?? assessment.data?.training_days?.length ?? 1));
  const sessionsDone = (workouts.data ?? []).filter((row) => row.completed_at).length;
  const caloriesGoal = Number(nutrition.data?.calories ?? estimateCalories(weight));
  const caloriesEaten = 0;
  const supplementItems = ((supplements.data ?? []) as SupplementRow[]).filter((item) => item.name).map((item) => ({ name: item.name, done: Array.isArray(item.supplement_logs) && item.supplement_logs.length > 0 }));
  const activeMembership = memberships.data?.[0] as MembershipRow | undefined;
  const trainerName = activeMembership?.trainer?.profiles?.display_name ?? null;
  const suggestedPlan = plans.data?.plan as { workouts?: { title?: string; minutes?: number; exercises?: string[]; kcal?: number }[] } | null;
  const suggestedWorkout = suggestedPlan?.workouts?.[0];

  return {
    name: firstName,
    rings: [Math.min(1, sessionsDone / sessionsGoal), Math.min(1, waterMl / waterGoal), Math.min(1, caloriesEaten / caloriesGoal)],
    workout: workouts.data?.[0]
      ? { title: workouts.data[0].title, trainer: trainerName, exercises: 0, minutes: Number(answers.training?.workout_duration_minutes ?? 0), kcal: 0 }
      : suggestedWorkout
        ? { title: suggestedWorkout.title ?? "تمرين مقترح", trainer: trainerName, exercises: suggestedWorkout.exercises?.length ?? 0, minutes: Number(suggestedWorkout.minutes ?? answers.training?.workout_duration_minutes ?? 45), kcal: Number(suggestedWorkout.kcal ?? 0) }
        : null,
    planPending: Boolean(assessment.data?.completed_at && !plans.data),
    water: { ml: waterMl, goal: waterGoal },
    meal: nutrition.data ? { label: "الوجبة القادمة", kcal: Math.round(caloriesGoal / 3), protein: nutrition.data.protein_g, carbs: nutrition.data.carbs_g, fat: nutrition.data.fat_g } : null,
    supplements: { taken: supplementItems.filter((item) => item.done).length, total: supplementItems.length, items: supplementItems },
    sessions: { done: sessionsDone, goal: sessionsGoal },
    calories: { eaten: caloriesEaten, goal: caloriesGoal }
  };
}

export async function addWater(ml: number): Promise<Result<number>> {
  const amount = Math.trunc(ml);
  if (amount < 1 || amount > 2000) return { ok: false, error: "كمية الماء غير صحيحة." };

  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: genericAuthError };

  const { error } = await supabase.from("water_logs").insert({ user_id: user.id, amount_ml: amount });
  if (error) return { ok: false, error: "تعذر حفظ الماء الآن." };
  return ok(amount);
}

function emptyHome(name: string): HomeData {
  return {
    name,
    rings: [0, 0, 0],
    workout: null,
    planPending: false,
    water: { ml: 0, goal: 2800 },
    meal: null,
    supplements: { taken: 0, total: 0, items: [] },
    sessions: { done: 0, goal: 1 },
    calories: { eaten: 0, goal: 2200 }
  };
}

function estimateCalories(weight: number) {
  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 80;
  return Math.round(Math.max(1600, safeWeight * 30));
}

async function ensureSuggestedPlans(supabase: ReturnType<typeof createSupabaseBrowserClient>, userId: string, input: OnboardingInput, assessmentId: string | null) {
  const calories = calculateCalories(input);
  const protein = Math.round(input.weightKg * (input.goal === "build_muscle" || input.goal === "strength" ? 2 : 1.7));
  const fat = Math.round(Math.max(45, input.weightKg * 0.8));
  const carbs = Math.round(Math.max(90, (calories - protein * 4 - fat * 9) / 4));

  await supabase.from("nutrition_plans").insert({
    user_id: userId,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    formula: "dababa_rule_v1",
    prompt_version: "rule-v1",
    source_inputs: { assessment_id: assessmentId, goal: input.goal, age: input.age, weight_kg: input.weightKg, height_cm: input.heightCm, activity_level: input.activityLevel }
  });

  await supabase.from("training_plans").insert({
    user_id: userId,
    title: "خطة مقترحة كبداية",
    goal: input.goal,
    prompt_version: "rule-v1",
    source_inputs: { assessment_id: assessmentId, days: input.trainingDays, injuries: input.injuries, level: input.trainingExperience },
    plan: buildWorkoutPlan(input),
    starts_on: new Date().toISOString().slice(0, 10)
  });
}

function calculateCalories(input: OnboardingInput) {
  const genderFactor = input.gender === "female" ? -161 : 5;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + genderFactor;
  const activity = input.activityLevel === "high" ? 1.55 : input.activityLevel === "moderate" ? 1.38 : 1.22;
  const goalDelta = input.goal === "lose_weight" ? -350 : input.goal === "build_muscle" || input.goal === "strength" ? 250 : 0;
  return Math.round(Math.min(6000, Math.max(1200, bmr * activity + goalDelta)));
}

function buildWorkoutPlan(input: OnboardingInput) {
  const split = input.trainingDays.length >= 4 ? ["Push", "Pull", "Legs", "Full body"] : ["Full body A", "Full body B", "Mobility"];
  const avoid = new Set(input.injuries);
  const exercises = ["Squat pattern", "Hip hinge", "Horizontal push", "Horizontal pull", "Core stability"].filter((item) => !(avoid.has("الركبة") && item === "Squat pattern"));
  return {
    status: "suggested",
    generated_by: "rule-v1",
    workouts: input.trainingDays.map((day, index) => ({
      day,
      title: split[index % split.length],
      minutes: input.workoutDurationMinutes,
      kcal: Math.round(input.workoutDurationMinutes * 6),
      exercises
    }))
  };
}
