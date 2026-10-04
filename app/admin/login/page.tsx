import type { Metadata } from "next";
import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export const metadata: Metadata = { title: "دخول الإدارة · دبابة", robots: { index: false, follow: false } };
export default function AdminLoginPage() { return <main className="app"><Suspense><AdminLoginForm /></Suspense></main>; }
