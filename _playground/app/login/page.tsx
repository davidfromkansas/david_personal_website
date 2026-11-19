"use client";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const password = new FormData(e.currentTarget).get("password");
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw Error((await res.json()).error);
      const target = new URL(
        new URLSearchParams(location.search).get("next") || "/",
        location.origin,
      );
      location.assign(target.origin === location.origin ? target.href : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
      setBusy(false);
    }
  }
  return (
    <main className="shell login">
      <h1>Private workspace</h1>
      <p>Enter your password to open the playground.</p>
      <form onSubmit={submit}>
        <label htmlFor="password">Password</label>
        <Input
          id="password"
          required
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <p role="alert">{error}</p>
        <Button disabled={busy}>
          {busy ? "Signing in…" : "Open playground"}
        </Button>
      </form>
    </main>
  );
}
