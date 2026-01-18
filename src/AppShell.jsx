import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

import { AppSidebar } from "./components/sidebar/app-sidebar";
import { AppHeader } from "./AppHeader";
import { AppBody } from "./components/misc/AppBody";

export function AppShell({ user }) {
  return (
    <div className="flex min-h-screen min-w-screen">
      <AppSidebar user={user} />

      <div className="flex flex-1 flex-col w-full">
        <AppHeader user={user} />
        <AppBody>
          <Outlet />
        </AppBody>
      </div>
    </div>
  );
}

