export type Locale = "ar" | "en";

export const copy = {
  ar: {
    appName: "دبابة",
    greeting: "جاهز يا عمر؟",
    subtitle: "خطة اليوم مضبوطة على تمرين القوة، ترطيب ذكي، وسعرات مناسبة لهدفك.",
    start: "ابدأ الجلسة",
    login: "تسجيل الدخول",
    theme: "المظهر",
    language: "English",
    smart: "تتبع ذكي",
    quickAdd: "إضافة سريعة",
    tabs: {
      home: "الرئيسية",
      workout: "التمرين",
      tracking: "التتبع",
      nutrition: "التغذية",
      hydration: "الماء",
      supplements: "المكملات",
      progress: "التقدم",
      settings: "الإعدادات",
      admin: "الإدارة"
    },
    sections: {
      health: "صحتي هذا الأسبوع",
      active: "المهمة النشطة",
      previous: "مهام سابقة",
      workout: "تمرين اليوم",
      tracking: "تسجيل مباشر",
      nutrition: "خطة السعرات",
      hydration: "هدف الماء",
      supplements: "جدول المكملات",
      progress: "قياسات التقدم",
      settings: "الإشعارات والتثبيت",
      admin: "معاينة الإدارة"
    }
  },
  en: {
    appName: "Dababa",
    greeting: "Ready, Omar?",
    subtitle: "Today is tuned for strength work, smart hydration, and calories that match your goal.",
    start: "Start session",
    login: "Log in",
    theme: "Theme",
    language: "العربية",
    smart: "Smart tracking",
    quickAdd: "Quick add",
    tabs: {
      home: "Home",
      workout: "Workout",
      tracking: "Tracking",
      nutrition: "Nutrition",
      hydration: "Hydration",
      supplements: "Supplements",
      progress: "Progress",
      settings: "Settings",
      admin: "Admin"
    },
    sections: {
      health: "My health this week",
      active: "Active task",
      previous: "Previous tasks",
      workout: "Today's workout",
      tracking: "Live tracking",
      nutrition: "Calorie plan",
      hydration: "Water goal",
      supplements: "Supplement schedule",
      progress: "Progress metrics",
      settings: "Notifications and install",
      admin: "Admin preview"
    }
  }
} as const;
