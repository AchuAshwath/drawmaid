import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/(app)/settings")({
  // Auth disabled for GitHub Pages - redirect to home
  beforeLoad: async () => {
    throw redirect({ to: "/" });
  },
  component: Settings,
});

function Settings() {
  useEffect(() => {
    window.location.href = "/";
  }, []);
  return null;
}
