# Drawmaid

Full-stack React application deployed on Cloudflare Workers. Bootstrapped with [React Starter Kit](https://github.com/kriasoft/react-starter-kit).

## Tech Stack

- [Bun](https://bun.sh/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Vitest](https://vitest.dev/)
- [React 19](https://react.dev/), [TanStack Router](https://tanstack.com/router), [Jotai](https://jotai.org/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- [Hono](https://hono.dev/), [tRPC](https://trpc.io/), [Better Auth](https://www.better-auth.com/)
- [Cloudflare Workers](https://workers.cloudflare.com/), [Cloudflare D1](https://developers.cloudflare.com/d1/), [Drizzle ORM](https://orm.drizzle.team/)
- [Astro](https://astro.build/) (marketing site)

## Project Structure

```
apps/app/       — React 19 SPA (TanStack Router, Jotai, Tailwind CSS v4)
apps/web/       — Astro marketing website
apps/api/       — tRPC API server (Hono on Cloudflare Workers)
apps/email/     — React Email templates
db/             — Drizzle ORM schemas, migrations, and seeds
packages/core/  — Shared types and utilities
packages/ui/    — Shared UI components (shadcn/ui)
infra/          — Terraform infrastructure
scripts/        — Build and utility scripts
```

## Getting Started

```bash
bun install      # Install dependencies
bun db:push      # Push DB schema to local D1
bun db:seed      # Seed sample data (optional)
bun dev          # Or, `bun api:dev` + `bun app:dev`
```

Configure environment variables in `.env` and `.env.local`, and Wrangler settings in [`apps/api/wrangler.jsonc`](./apps/api/wrangler.jsonc).

## Deployment

```bash
bun run build                                        # Build
bun web:deploy && bun api:deploy && bun app:deploy   # Deploy
```

Configure production secrets via `bun wrangler secret put <KEY>` from the target app directory.

## License

UNLICENSED
