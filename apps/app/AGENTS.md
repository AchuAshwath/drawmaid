Client-side SPA — no SSR. All rendering happens in the browser.

## Routing

- File-based routing in `routes/`. `lib/routeTree.gen.ts` is auto-generated — never edit it.
- Route groups: `(app)/` = protected, `(auth)/` = public. Parentheses don't affect URLs.
- `route.tsx` in a group = layout with shared `beforeLoad`; individual files for pages.

## Authentication

- Session state via `useSessionQuery()` from `lib/queries/session.ts`. NEVER use `auth.useSession()` — TanStack Query provides caching, multi-tab sync, and consistency.
- Auth guard in `beforeLoad`, not in components. Uses cache-first (`getCachedSession()`), then `fetchQuery()`.
- Must validate both `user` AND `session` (not just one).
- After login: call `revalidateSession(queryClient, router)` — removes cache + invalidates router so `beforeLoad` fetches fresh data, then navigate.
- Safe redirects: use `getSafeRedirectUrl()` for `returnTo` search params (prevents open redirects).
- `signOut(queryClient)` clears server session, invalidates cache, redirects to `/login`.

## tRPC Client

- `credentials: "include"` for cookie-based auth, batched via `httpBatchLink`.
- API URL: `${import.meta.env.VITE_API_URL || "/api"}/trpc`.
- Uses `createTRPCOptionsProxy()` for TanStack Query integration.

## Components

- Named exports, functional only. shadcn/ui from `@repo/ui`.
- Navigation: `<Link>` from TanStack Router with `activeProps` for active styling. Never use `<a>` for internal routes.
- Route context: `Route.useSearch()` for search params, `Route.useRouteContext()` for route data.
- Jotai store available for cross-route UI state (modals, sidebar).

## Excalidraw UI Customization

- UI building blocks: render Excalidraw children to customize UI: `MainMenu`, `WelcomeScreen`, `Sidebar`, `Footer`, `LiveCollaborationTrigger`.
- Main menu: render `<MainMenu>` to fully control menu contents; use `MainMenu.DefaultItems.*` for standard items and `MainMenu.Group` to group them.
- Welcome screen: render `<WelcomeScreen>` when canvas is empty; customize `WelcomeScreen.Center` (logo/heading/menu) and `WelcomeScreen.Hints.*`.
- Sidebar: render `<Sidebar name="...">` for custom panels; can add tabs via `Sidebar.Tabs`, `Sidebar.Tab`, and `Sidebar.TabTrigger`. Use `Sidebar.Trigger` or `excalidrawAPI.toggleSidebar()` to open/close.
- Footer: render `<Footer>` as a child of `<Excalidraw>` for custom bottom UI. For mobile, render footer content inside `MainMenu` using `useEditorInterface()`.
- Top-right UI: use `renderTopRightUI` prop to add custom controls in the top-right chrome.

## Excalidraw Theme & Styling

- Theme control: use `initialData.appState.theme` for default theme and `UIOptions.canvasActions.toggleTheme` to show the theme picker.
- UIOptions: customize menu actions via `UIOptions.canvasActions` and sidebar docking via `UIOptions.dockedSidebarBreakpoint`.
- Styling: override Excalidraw CSS variables on `.excalidraw` and `.excalidraw.theme--dark` to match Drawmaid theme; add higher specificity via an app wrapper class.
- Reference: see Excalidraw `theme.scss` for full variable list; prefer adjusting `--color-primary*` variables first.

## Error Handling

- `AppErrorBoundary` (root) shows generic error UI. `AuthErrorBoundary` (protected routes) catches 401/UNAUTHORIZED and shows sign-in recovery UI; 403 falls through to generic handler.
- Utilities in `lib/errors.ts`: `getErrorStatus()`, `isUnauthenticatedError()`, `getErrorMessage()`.
