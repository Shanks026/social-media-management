import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import LoginPage from "./components/auth/login";
import SignupPage from "./components/auth/signup";
import { AppShell } from "./components/misc/AppShell";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";

export default function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      queryClient.clear();
    }
  });

  return (
    <Routes>
      {/* 🔓 Public routes */}
      {!session && (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}

      {/* 🔒 Protected routes */}
      {session && (
        <Route element={<AppShell user={user} />}>
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:clientId" element={<ClientDetails />} />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Route>
      )}
    </Routes>
  );
}
