import { AuthErrorBoundary } from "@/components/auth";
import { Layout } from "@/components/layout";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  // Auth disabled for GitHub Pages deployment - redirect all to home
  beforeLoad: async ({ location }) => {
    throw redirect({
      to: "/",
      search: { returnTo: location.href },
    });
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AuthErrorBoundary>
      <Layout>
        <Outlet />
      </Layout>
    </AuthErrorBoundary>
  );
}
