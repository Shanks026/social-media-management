import { HeaderProvider } from "./header-context";
import { AppSidebar } from "../sidebar/app-sidebar";
import { AppHeader } from "./AppHeader";
import { AppBody } from "./AppBody";
import { Outlet } from "react-router-dom";

export function AppShell({ user }) {
  return (
    <HeaderProvider>
      <div className="flex min-h-screen min-w-screen">
        <AppSidebar user={user} />

        <div className="flex flex-1 flex-col w-full">
          <AppHeader user={user} />
          <AppBody>
            <Outlet context={{ user }} />
          </AppBody>
        </div>
      </div>
    </HeaderProvider>
  );
}
