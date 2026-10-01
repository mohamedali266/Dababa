import { DashboardShell } from "@/features/dashboard/dashboard-shell";

type HomeProps = {
  searchParams?: Promise<{ security?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  return <DashboardShell securityAlert={params?.security ?? null} />;
}
