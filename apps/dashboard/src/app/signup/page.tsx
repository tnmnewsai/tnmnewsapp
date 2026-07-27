import Link from "next/link";
import SignupForm from "./SignupForm";
import styles from "../login/login.module.css";

export default function SignupPage() {
  return (
    <main className={styles.wrap}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
        <SignupForm />
        <Link href="/login">Already have an account? Sign in</Link>
      </div>
    </main>
  );
}
