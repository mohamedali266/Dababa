import {
  Activity,
  Bell,
  Bike,
  BrainCircuit,
  Dumbbell,
  Droplets,
  Flame,
  Footprints,
  HeartPulse,
  Moon,
  Salad,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Utensils,
  Waves
} from "lucide-react";

export const healthStats = [
  { labelAr: "خطوات", labelEn: "Steps", value: "8,420", unitAr: "خطوة", unitEn: "steps", icon: Footprints },
  { labelAr: "نشاط", labelEn: "Move", value: "62", unitAr: "دقيقة", unitEn: "min", icon: Activity },
  { labelAr: "سعرات", labelEn: "Calories", value: "1,940", unitAr: "سعرة", unitEn: "kcal", icon: Flame },
  { labelAr: "نوم", labelEn: "Sleep", value: "7.4", unitAr: "ساعة", unitEn: "hr", icon: Moon }
] as const;

export const previousTasks = [
  { labelAr: "صدر وكتف", labelEn: "Chest & shoulders", value: 82, noteAr: "أمس", noteEn: "Yesterday" },
  { labelAr: "مشي سريع", labelEn: "Fast walk", value: 68, noteAr: "قبل يومين", noteEn: "2 days ago" },
  { labelAr: "خطة الماء", labelEn: "Water plan", value: 91, noteAr: "مكتملة", noteEn: "Complete" }
] as const;

export const workoutExercises = [
  { nameAr: "ضغط بنش مائل", nameEn: "Incline bench press", sets: 4, reps: "8-10", weight: 62.5, rest: 90, pr: true },
  { nameAr: "سحب أرضي", nameEn: "Seated row", sets: 3, reps: "10-12", weight: 55, rest: 75, pr: false },
  { nameAr: "رفرفة كتف", nameEn: "Lateral raise", sets: 3, reps: "12-15", weight: 12, rest: 60, pr: false },
  { nameAr: "بلانك", nameEn: "Plank", sets: 3, reps: "45s", weight: 0, rest: 45, pr: true }
] as const;

export const meals = [
  { labelAr: "فطور", labelEn: "Breakfast", kcal: 520, macros: "42P / 58C / 14F", icon: Utensils },
  { labelAr: "غداء", labelEn: "Lunch", kcal: 760, macros: "55P / 70C / 24F", icon: Salad },
  { labelAr: "وجبة بعد التمرين", labelEn: "Post workout", kcal: 310, macros: "32P / 28C / 6F", icon: Sparkles }
] as const;

export const supplements = [
  { labelAr: "كرياتين", labelEn: "Creatine", dose: "5g", timeAr: "بعد التمرين", timeEn: "Post workout", done: true },
  { labelAr: "فيتامين د", labelEn: "Vitamin D", dose: "2000 IU", timeAr: "مع الفطور", timeEn: "With breakfast", done: true },
  { labelAr: "أوميجا 3", labelEn: "Omega 3", dose: "1000mg", timeAr: "مع الغداء", timeEn: "With lunch", done: false }
] as const;

export const progressRows = [
  { labelAr: "الوزن", labelEn: "Weight", value: "84.2 kg", changeAr: "-0.8 هذا الشهر", changeEn: "-0.8 this month", valuePct: 61 },
  { labelAr: "ضغط البنش", labelEn: "Bench press", value: "72.5 kg", changeAr: "+7.5 منذ البداية", changeEn: "+7.5 since start", valuePct: 74 },
  { labelAr: "محيط الخصر", labelEn: "Waist", value: "88 cm", changeAr: "-3 سم", changeEn: "-3 cm", valuePct: 48 }
] as const;

export const reminders = [
  { labelAr: "تذكير التمرين", labelEn: "Workout reminder", icon: Dumbbell, enabled: true },
  { labelAr: "الماء كل ساعتين", labelEn: "Water every 2 hours", icon: Droplets, enabled: true },
  { labelAr: "وقت المكملات", labelEn: "Supplement time", icon: Bell, enabled: false },
  { labelAr: "هدوء 11م - 7ص", labelEn: "Quiet 11pm - 7am", icon: Moon, enabled: true }
] as const;

export const adminStats = [
  { labelAr: "مستخدمون نشطون", labelEn: "Active users", value: "12.8k", icon: Users },
  { labelAr: "طلبات AI", labelEn: "AI requests", value: "38.4k", icon: BrainCircuit },
  { labelAr: "تسليم إشعارات", labelEn: "Notification delivery", value: "94%", icon: Bell },
  { labelAr: "سجل تدقيق", labelEn: "Audit events", value: "1,284", icon: ShieldCheck }
] as const;

export const trackingMetrics = [
  { labelAr: "المدة", labelEn: "Duration", value: "38:12", icon: Timer },
  { labelAr: "المسافة", labelEn: "Distance", value: "4.8 km", icon: Bike },
  { labelAr: "نبض", labelEn: "Heart rate", value: "142 bpm", icon: HeartPulse },
  { labelAr: "إيقاع", labelEn: "Pace", value: "7'58\"", icon: Waves }
] as const;
