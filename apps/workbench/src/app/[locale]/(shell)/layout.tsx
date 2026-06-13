import { CommandMenu } from "@/components/shell/command-menu";
import { ShellDrawer } from "@/components/shell/shell-drawer";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellTopbar } from "@/components/shell/shell-topbar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ShellSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <ShellDrawer />
      <CommandMenu />
    </div>
  );
}
