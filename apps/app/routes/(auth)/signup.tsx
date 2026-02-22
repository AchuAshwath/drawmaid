import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/(auth)/signup")({
  // Auth disabled for GitHub Pages - redirect to home
  beforeLoad: async () => {
    throw redirect({ to: "/" });
  },
  component: SignupPage,
});

function SignupPage() {
  useEffect(() => {
    window.location.href = "/";
  }, []);
  return null;
}
