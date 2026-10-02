// CONTRACT between frontend and backend. Backend may add fields but must not rename or remove.
export type Role = "admin" | "owner" | "trainer" | "player";
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type JoinPreview = { clubName: string; trainerName: string | null; planDays: number };
export type HomeData = {
  name: string;
  rings: [number, number, number]; // workout, water, calories: 0..1
  workout: { title: string; trainer: string | null; exercises: number; minutes: number; kcal: number } | null;
  water: { ml: number; goal: number };
  meal: { label: string; kcal: number; protein: number; carbs: number; fat: number } | null;
  supplements: { taken: number; total: number; items: { name: string; done: boolean }[] };
  sessions: { done: number; goal: number };
  calories: { eaten: number; goal: number };
};
