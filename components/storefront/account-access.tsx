"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createAuthClient } from "@neondatabase/neon-js/auth";
import {
  BetterAuthVanillaAdapter,
  type BetterAuthVanillaAdapterInstance,
} from "@neondatabase/neon-js/auth/vanilla/adapters";
import { Eye, EyeOff, Loader2, LogOut, X } from "lucide-react";

type AccountMode = "signup" | "signin";
type ApiUser = { email: string; name?: string };
type AuthClient = ReturnType<
  typeof createAuthClient<BetterAuthVanillaAdapterInstance>
>;

const DEFAULT_API_URL = "https://hsg-be.onrender.com";

let authClient: AuthClient | undefined;
const ACCOUNT_CHANGED_EVENT = "hsg-account-changed";

function getAuthServices() {
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim();
  const apiUrl = process.env.NEXT_PUBLIC_HSG_API_URL?.trim() || DEFAULT_API_URL;
  if (!authUrl) {
    throw new Error(
      "Account access is not configured. Set NEXT_PUBLIC_NEON_AUTH_URL before building the storefront.",
    );
  }

  let parsedAuthUrl: URL;
  let parsedApiUrl: URL;
  try {
    parsedAuthUrl = new URL(authUrl);
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error(
      "Set valid absolute URLs for NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_HSG_API_URL.",
    );
  }
  const isLocalhost = (url: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (parsedAuthUrl.protocol !== "https:" && !isLocalhost(parsedAuthUrl)) {
    throw new Error(
      "NEXT_PUBLIC_NEON_AUTH_URL must use HTTPS outside localhost.",
    );
  }
  if (
    (parsedApiUrl.protocol !== "https:" && !isLocalhost(parsedApiUrl)) ||
    parsedApiUrl.pathname !== "/" ||
    parsedApiUrl.search ||
    parsedApiUrl.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_HSG_API_URL must be an HTTPS API origin (localhost is allowed for development).",
    );
  }

  authClient ??= createAuthClient(authUrl, {
    adapter: BetterAuthVanillaAdapter({
      fetchOptions: { credentials: "include" },
    }),
  });
  return { auth: authClient, apiUrl: apiUrl.replace(/\/+$/, "") };
}

async function readCurrentUser(): Promise<ApiUser | null> {
  try {
    const { auth, apiUrl } = getAuthServices();
    const { data, error } = await auth.token();
    if (error || !data?.token) return null;
    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    return response.ok ? ((await response.json()) as ApiUser) : null;
  } catch {
    return null;
  }
}

function announceAccountChange(user: ApiUser | null) {
  window.dispatchEvent(
    new CustomEvent<ApiUser | null>(ACCOUNT_CHANGED_EVENT, { detail: user }),
  );
}

function useCustomerAccount() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    void readCurrentUser().then((current) => {
      if (mounted) {
        setUser(current);
        setChecking(false);
      }
    });
    const sync = (event: Event) => {
      setUser((event as CustomEvent<ApiUser | null>).detail ?? null);
      setChecking(false);
    };
    window.addEventListener(ACCOUNT_CHANGED_EVENT, sync);
    return () => {
      mounted = false;
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, sync);
    };
  }, []);

  const logout = async () => {
    const { auth } = getAuthServices();
    const result = await auth.signOut();
    if (result.error)
      throw new Error(result.error.message ?? "Could not sign out.");
    announceAccountChange(null);
  };

  return { user, checking, logout };
}

export function AccountProfileButton() {
  const { user, checking, logout } = useCustomerAccount();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  if (checking || !user) return null;

  return (
    <div className="header-profile">
      <button
        type="button"
        className="header-profile-button"
        aria-label="View your profile"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Profile
      </button>
      {open && (
        <section className="header-profile-menu" aria-label="Your profile">
          <div className="header-profile-avatar" aria-hidden="true">
            {(user.name?.trim()[0] ?? user.email[0] ?? "U").toUpperCase()}
          </div>
          <div className="header-profile-details">
            <b>{user.name?.trim() || "HSG Texture customer"}</b>
            <span>{user.email}</span>
          </div>
          {error && <small role="alert">{error}</small>}
          <button
            type="button"
            className="header-profile-logout"
            disabled={loggingOut}
            onClick={async () => {
              setError("");
              setLoggingOut(true);
              try {
                await logout();
                setOpen(false);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not sign out.",
                );
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            {loggingOut ? (
              <Loader2 size={15} className="admin-activity-spinner" />
            ) : (
              <LogOut size={15} />
            )}{" "}
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </section>
      )}
    </div>
  );
}

export function AccountAccess() {
  const { user, checking } = useCustomerAccount();
  const [mode, setMode] = useState<AccountMode>("signup");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [email, setEmail] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const showForm = (nextMode: AccountMode) => {
    setMode(nextMode);
    setError("");
    setExistingAccount(false);
    setMessageTitle("");
    setMessage("");
    setToastMessage("");
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setExistingAccount(false);
    setMessage("");
    setPending(true);

    let accountCreated = false;
    try {
      const { auth, apiUrl } = getAuthServices();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "")
        .trim()
        .toLowerCase();
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
        const errorMessage =
          result.error.message ??
          "Neon could not process your account request.";
        const accountExists =
          mode === "signup" && /already exists/i.test(errorMessage);
        setExistingAccount(accountExists);
        setError(
          accountExists
            ? "An account already exists with this email. Sign in instead."
            : errorMessage,
        );
        return;
      }
      accountCreated = mode === "signup";

      const { data: tokenData, error: tokenError } = await auth.token();
      if (tokenError) throw new Error(tokenError.message);
      if (!tokenData?.token) {
        setMessageTitle(
          accountCreated
            ? "Account created successfully"
            : "Sign-in needs attention",
        );
        setMessage(
          accountCreated
            ? "Your HSG Texture account was created successfully. Check your email if Neon requires verification, then sign in."
            : "Neon signed you in, but did not return an access token for HSG verification.",
        );
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${tokenData.token}` },
        });
      } catch (cause) {
        if (!(cause instanceof TypeError)) throw cause;
        throw new Error(
          "The HSG API could not be reached. Check the connection and that this storefront origin is allowed in the BE CORS_ORIGINS.",
        );
      }
      if (!response.ok) {
        throw new Error(
          `HSG account verification failed (HTTP ${response.status}).`,
        );
      }
      const user = (await response.json()) as ApiUser;
      announceAccountChange(user);
      if (!accountCreated) {
        setOpen(false);
        setToastMessage(
          `Signed in successfully${user.name ? `, ${user.name}` : ""}. Welcome back!`,
        );
        return;
      }
      setMessageTitle("Account created successfully");
      setMessage(
        `Your HSG Texture account was created successfully${user.name ? `, ${user.name}` : ""}. Welcome!`,
      );
    } catch (cause) {
      const details =
        cause instanceof Error
          ? cause.message
          : "An unexpected error occurred.";
      if (accountCreated) {
        setMessageTitle("Account created successfully");
        setMessage(
          `Your HSG Texture account was created successfully. HSG could not verify your session yet: ${details}`,
        );
      } else {
        setError(details);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="footer-account-actions">
        {!checking && user ? (
          <div className="footer-account-signed-in">
            <span>Already logged in</span>
            <strong>{user.email}</strong>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => showForm("signup")}>
              Create an account
            </button>
            <button type="button" onClick={() => showForm("signin")}>
              Sign in
            </button>
          </>
        )}
      </div>
      {toastMessage && (
        <div className="account-success-toast" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          {toastMessage}
        </div>
      )}
      {open && (
        <div
          className="account-modal-backdrop"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
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
              disabled={pending}
              onClick={() => {
                if (!pending) setOpen(false);
              }}
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
                    disabled={pending}
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
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setExistingAccount(false);
                    setError("");
                  }}
                  required
                  maxLength={254}
                  disabled={pending}
                />
              </label>
              <label>
                Password
                <span className="password-field">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    placeholder={
                      mode === "signup"
                        ? "Create a password"
                        : "Enter your password"
                    }
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={pending}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error && (
                <div className="account-form-message error" role="alert">
                  {error}
                  {existingAccount && (
                    <button
                      className="account-existing-signin"
                      type="button"
                      onClick={() => showForm("signin")}
                    >
                      Sign in
                    </button>
                  )}
                </div>
              )}
              {message && (
                <div
                  className="account-form-message"
                  role="status"
                  aria-live="polite"
                >
                  <b>{messageTitle}</b>
                  <p>{message}</p>
                </div>
              )}
              <button
                className="account-submit"
                type="submit"
                disabled={pending}
              >
                {pending
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p className="account-mode-switch">
              {mode === "signup"
                ? "Already have an account?"
                : "New to HSG Texture?"}{" "}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  showForm(mode === "signup" ? "signin" : "signup")
                }
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
