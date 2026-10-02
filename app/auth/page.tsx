import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function AuthPage() {
  return <main className="app"><Suspense><AuthForm /></Suspense></main>;
}
