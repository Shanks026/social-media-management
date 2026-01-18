import { useState } from "react";
import { LoginForm } from "./login";
import { SignupForm } from "./signup-form";

export function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {mode === "login" ? (
          <LoginForm
            onSubmit={(e) => {
              e.preventDefault();
              onAuthSuccess();
            }}
          />
        ) : (
          <SignupForm
            onSubmit={(e) => {
              e.preventDefault();
              onAuthSuccess();
            }}
          />
        )}

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="underline underline-offset-4"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
