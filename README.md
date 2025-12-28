This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Features

- **Reown AppKit** - Email and wallet authentication
- **Lazy User Creation** - Users are created in the database only when needed (e.g., when creating todos)
- **JWT Sessions** - Secure session management with HTTP-only cookies
- **Drizzle ORM** - Type-safe database queries

## Getting Started

### Environment Variables

Create a `.env.local` file with:

```bash
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret_key
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
```

### Database Setup

1. Run migrations or push schema:
   ```bash
   pnpm db:push
   ```

2. **If using Supabase**: You may need to configure Row Level Security (RLS) policies or use a service role key for the `DATABASE_URL`. The app uses lazy user creation, so authentication works even if RLS blocks initial user creation - users will be created when they first interact with database features (like creating todos).

### Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# medichat-beta
