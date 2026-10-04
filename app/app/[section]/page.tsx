import { notFound } from "next/navigation";

const NAMES: Record<string, string> = { workout: "التمرين", nutrition: "التغذية", progress: "التقدم" };
export function generateStaticParams() { return Object.keys(NAMES).map((section) => ({ section })); }

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const name = NAMES[section];
  if (!name) notFound();
  return (
    <>
      <h1>{name}</h1>
      <section className="glass empty"><b>الشاشة دي بتتجهز</b><span>هتتضاف في المرحلة الجاية.</span></section>
    </>
  );
}
