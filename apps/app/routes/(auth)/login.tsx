import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/(auth)/login")({
  // Auth disabled for GitHub Pages - redirect to home
  beforeLoad: async () => {
    throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  useEffect(() => {
    window.location.href = "/";
  }, []);
  return null;
}
