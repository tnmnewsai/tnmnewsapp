"use client";

import { useState, useTransition } from "react";
import { updateOwnEmail, updateOwnPassword } from "./actions";
import styles from "./admin.module.css";

export default function AccountSecurityForm({ email }: { email: string }) {
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailPending, startEmailTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  return (
    <section className={styles.securitySection}>
      <h2>Account settings</h2>
      <p className={styles.empty}>Changing either setting signs you out. Sign back in with the updated credentials.</p>
      <form className={styles.securityForm} onSubmit={(event) => {
        event.preventDefault();
        setEmailError(null);
        const data = new FormData(event.currentTarget);
        startEmailTransition(async () => {
          try { await updateOwnEmail(String(data.get("email") ?? ""), String(data.get("currentPassword") ?? "")); }
          catch (error) { setEmailError(error instanceof Error ? error.message : "Email update failed."); }
        });
      }}>
        <h3>Change email</h3>
        <label>Email<input name="email" type="email" defaultValue={email} required autoComplete="email" /></label>
        <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
        {emailError && <p role="alert" className={styles.formError}>{emailError}</p>}
        <button type="submit" disabled={emailPending}>{emailPending ? "Updating…" : "Update email"}</button>
      </form>
      <form className={styles.securityForm} onSubmit={(event) => {
        event.preventDefault();
        setPasswordError(null);
        const data = new FormData(event.currentTarget);
        startPasswordTransition(async () => {
          try {
            await updateOwnPassword(String(data.get("currentPassword") ?? ""), String(data.get("newPassword") ?? ""), String(data.get("confirmPassword") ?? ""));
          } catch (error) { setPasswordError(error instanceof Error ? error.message : "Password update failed."); }
        });
      }}>
        <h3>Change password</h3>
        <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
        <label>New password<input name="newPassword" type="password" minLength={12} required autoComplete="new-password" /></label>
        <label>Confirm new password<input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" /></label>
        {passwordError && <p role="alert" className={styles.formError}>{passwordError}</p>}
        <button type="submit" disabled={passwordPending}>{passwordPending ? "Updating…" : "Update password"}</button>
      </form>
    </section>
  );
}
