"use client";

import { useState } from "react";
import { registerAccount } from "./actions";
import styles from "../login/login.module.css";

export default function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    try {
      await registerAccount(form);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className={styles.card} onSubmit={onSubmit}>
      <h1>Create your account</h1>
      <label>
        Your name
        <input name="name" type="text" required autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Brand / channel name
        <input name="brandName" type="text" required placeholder="e.g. Acme Media" />
      </label>
      <label>
        Password
        <input name="password" type="password" required autoComplete="new-password" minLength={8} />
      </label>
      <label>
        Confirm password
        <input name="confirmPassword" type="password" required autoComplete="new-password" minLength={8} />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
