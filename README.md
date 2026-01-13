# Kyral MediChat AI Assistant (Beta)

Kyral's AI medical health assistant Medichat is an open-source, privacy-first AI health assistant that puts patients back in control of their health data. Medichat is powered by QWEN3-NEXT-80B, a custom-trained open-source model fine-tuned on the de-identified PMC Patient Summaries dataset — a peer-reviewed resource of real clinical case studies.

This application helps analyze patient symptoms and provides potential diagnoses with confidence scores, reasoning, insights and recommended actions. MediChat is self-hosted on Azure, private and secure.

## "Small Enough to Trust, Smart Enough to Help"
While OpenAI and Anthropic build walled gardens around your most intimate health information, Kyral Medichat offers something revolutionary: an AI health assistant you can actually verify, own, and trust.

## What Is Medichat?
Medichat is an open-source AI health assistant that provides:
- Symptom assessment and health guidance — Understand your symptoms and potential next steps
- Treatment information — Learn about medications, procedures, care options and recommendations
- Cost transparency — Understand how healthcare systems operate, coverage and potential costs, regulations and your rights
- ICD-10 and medical code lookup — Support for medical coding, billing accuracy, claims management and interoperability standards
- General medical knowledge — Access clear, understandable health information

Available now at: https://medichat.kyralhealth.com

## Features

- User-friendly form interface to provide patient symptoms, existing conditions, medications, and/or lab results.
- Comprehensive data fields for analysis include:
  - Chat field and chat history
  - Daily overview
  - Document upload feature in pdf or text
  - Data entry for basic patient information
  - History and timeline of data and results
  - Invite links to share with physicians
  - Physician view to manage patients and create invite links

## Technical Specifications:
- Model: QWEN3-NEXT-80B (4-bit quantized)
- Hardware: Runs on 2x NVIDIA H100 GPUs (192 GB VRAM)
- Key advantage: Small enough to run locally, smart enough to help
 
## Privacy and Data Collection
- No data is stored following submission for analysis
- No data is used for model training or fine-tuning
- No user data is sold or used for any other purposes

## Important Note

This application is for informational purposes only and should not replace professional medical advice. Always consult with qualified healthcare professionals for medical diagnosis and treatment. Please refer to Kyral Health's Disclaimer, Privacy Policy and Terms and Conditions at https://kyralhealth.com

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

# AI Configuration
# Base URL for the OpenAI-compatible API (default: https://openrouter.ai/api/v1)
AI_API_BASE=https://openrouter.ai/api/v1

# API Key (required)
AI_API_KEY=your_api_key

# Models (optional, defaults to openai/gpt-4o and openai/gpt-4o-mini)
AI_MODEL_CHAT=openai/gpt-4o
AI_MODEL_EXTRACT=openai/gpt-4o-mini
AI_MODEL_DASHBOARD=openai/gpt-4o-mini
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

## License

[Apache 2.0 License](LICENSE)
