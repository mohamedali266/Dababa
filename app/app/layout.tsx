import BottomNav from "@/components/BottomNav";
import { playerTabs } from "@/lib/tabs";

// Backend: guard this layout server-side (authenticated + active user) before rendering.
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="app">{children}</main>
      <BottomNav tabs={playerTabs} />
    </>
  );
}
