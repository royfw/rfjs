import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bedrock text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          <div className="sticky top-14">
            <AppSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
