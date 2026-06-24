# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
- When a command or operation fails repeatedly (3+ times with same error), stop retrying and escalate to the user instead of continuing to try variations. Confidence: 0.90

# frontend
- Ensure full mobile-friendliness across all pages and components, not just the navigation — every screen should be responsive. Confidence: 0.75

# prioritization
- Fix technical correctness (auth wiring, DB connectivity, broken pages) before doing any UI/UX polish. The user values functional integrity over visual improvements. Confidence: 0.75

# workflow
- User prefers to run commands manually in their own terminals — provide copy-pasteable commands rather than executing them automatically, especially for backend/frontend startup. Confidence: 0.70

# communication
- Keep responses direct, terse, and solutions-focused. Skip lengthy explanations and formal language. The user communicates bluntly and prefers matching tone. Confidence: 0.70

# architecture
- For Vercel deployments proxying to a non-Vercel backend (Railway, Render, etc.), use a Next.js API proxy route at `/app/api/proxy/[[...slug]]/route.ts` that reads `BACKEND_URL` env var and forwards requests via `fetch()` — Vercel's `async rewrites()` and Edge middleware cannot reach private/restricted backends. Confidence: 0.85

# workflow
- Always run the full e2e test suite (`npx tsx e2e-test.mjs`) after significant changes to the backend or deployment configuration before declaring anything working. Confidence: 0.70

