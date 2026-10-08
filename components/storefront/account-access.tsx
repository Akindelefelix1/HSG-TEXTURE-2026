"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/neon-js/auth";
import {
  BetterAuthVanillaAdapter,
  type BetterAuthVanillaAdapterInstance,
} from "@neondatabase/neon-js/auth/vanilla/adapters";
import { X } from "lucide-react";

type AccountMode = "signup" | "signin";
type ApiUser = { email: string; name?: string };
type AuthClient = ReturnType<
  typeof createAuthClient<BetterAuthVanillaAdapterInstance>
>;

const DEFAULT_API_URL = "https://hsg-be.onrender.com";

let authClient: AuthClient | undefined;

function getAuthServices() {
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
  const apiUrl = process.env.NEXT_PUBLIC_HSG_API_URL || DEFAULT_API_URL;
  if (!authUrl) {
    throw new Error(
      "Account access is not configured. Set NEXT_PUBLIC_NEON_AUTH_URL before building the storefront.",
    );
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_HSG_API_URL must be a valid absolute URL.");
  }
  if (parsedApiUrl.protocol !== "https:" && parsedApiUrl.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_HSG_API_URL must use HTTPS outside localhost.");
  }

  authClient ??= createAuthClient(authUrl, {
    adapter: BetterAuthVanillaAdapter({
      fetchOptions: { credentials: "include" },
    }),
  });
  return { auth: authClient, apiUrl: apiUrl.replace(/\/+$/, "") };
}

export function AccountAccess() {
  const [mode, setMode] = useState<AccountMode>("signup");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const showForm = (nextMode: AccountMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    let accountCreated = false;
    try {
      const { auth, apiUrl } = getAuthServices();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const result =
        mode === "signup"
          ? await auth.signUp.email({
              name: String(formData.get("name") ?? "").trim(),
              email,
              password,
            })
          : await auth.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Neon could not process your account request.");
        return;
      }
      accountCreated = mode === "signup";

      const { data: tokenData, error: tokenError } = await auth.token();
      if (tokenError) throw new Error(tokenError.message);
      if (!tokenData?.token) {
        setMessage(
          accountCreated
            ? "Your account was created. Check your email if verification is required, then sign in."
            : "Neon signed you in, but did not return an access token for HSG verification.",
        );
        return;
      }

      const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokenData.token}` },
      });
      if (!response.ok) {
        throw new Error(`HSG account verification failed (HTTP ${response.status}).`);
      }
      const user = (await response.json()) as ApiUser;
      setMessage(`Welcome${user.name ? `, ${user.name}` : ""}. Your account is ready.`);
    } catch (cause) {
      const details =
        cause instanceof Error ? cause.message : "An unexpected error occurred.";
      setError(
        accountCreated
          ? `Your Neon account was created, but HSG could not verify it: ${details}`
          : details,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="footer-account-actions">
        <button type="button" onClick={() => showForm("signup")}>Create an account</button>
        <button type="button" onClick={() => showForm("signin")}>Sign in</button>
      </div>
      {open && (
        <div className="account-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="account-modal-close"
              type="button"
              aria-label="Close account form"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
            <p className="eyebrow">HSG Texture account</p>
            <h2 id="account-modal-title">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="account-modal-intro">
              {mode === "signup"
                ? "Sign up securely with Neon to get started."
                : "Sign in to your HSG Texture account."}
            </p>
            <form className="account-form" onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    required
                    maxLength={120}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
              {error && <p className="account-form-message error" role="alert">{error}</p>}
              {message && <p className="account-form-message" role="status">{message}</p>}
              <button className="account-submit" type="submit" disabled={pending}>
                {pending
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p className="account-mode-switch">
              {mode === "signup" ? "Already have an account?" : "New to HSG Texture?"}{" "}
              <button
                type="button"
                onClick={() => showForm(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
        </div>
      )}
    </>
  );
}
