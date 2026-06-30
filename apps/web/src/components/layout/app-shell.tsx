import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bedrock text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          {/* Bound the sticky sidebar to the viewport and give it its own
              scroll, so a long nav scrolls independently of the page content
              instead of scrolling along with it once it exceeds the viewport. */}
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto overscroll-contain">
            <AppSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
