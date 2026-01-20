# Kyral MediChat AI Health Assistant (Beta)

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

## Key Capabilities

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
- Model: QWEN3-NEXT-80B (QLORA finetuned)
- Hardware: Runs on 2x NVIDIA H100 GPUs (192 GB VRAM)
- Key advantage: Small enough to run locally, smart enough to help
 
## Privacy and Data Collection
- No data is stored following submission for analysis
- No data is used for model training or fine-tuning
- No user data is sold or used for any other purposes

## Important Note

This application is for informational purposes only and should not replace professional medical advice. Always consult with qualified healthcare professionals for medical diagnosis and treatment. Please refer to Kyral Health's Disclaimer, Privacy Policy and Terms and Conditions at https://kyralhealth.com

## Features

- **Secure Authentication** - Powered by Clerk
- **AI Health Assistant** - Integrated with QWEN3-NEXT-80B (via vLLM) or OpenAI-compatible providers for symptom analysis and health insights.
- **Document Intelligence** - Upload and analyze PDFs/texts for medical history context using localized RAG.
- **Dual-Mode Interface**:
  - **Patient Portal**: Symptom logging, chat history, document uploads, and daily dashboards.
  - **Physician Portal**: Patient invitations, data review, and management dashboards.
- **Modern Stack** - built with Next.js 15+ (App Router), Tailwind CSS 4, and Drizzle ORM.
- **Privacy Focused** - Capable of full self-hosting with local LLM inference.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Database:** PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [Clerk](https://clerk.com/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **AI/LLM:** OpenAI SDK, [vLLM](https://docs.vllm.ai/en/latest/) (for local hosting)
- **Monitoring:** [Sentry](https://sentry.io/)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose (required for local LLM hosting)
- PostgreSQL Database

### 1. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in the required environment variables in `.env.local`:
- **Database**: `DATABASE_URL`
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **AI Provider**: `AI_API_KEY`, `AI_API_BASE` (defaults to OpenRouter, or local vLLM)

### 2. Installation

Install dependencies:

```bash
pnpm install
```

### 3. Database Setup

Push the schema to your database:

```bash
pnpm db:push
```

### 4. Running the Application

**Development Mode:**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## License

[Apache 2.0 License](LICENSE)
