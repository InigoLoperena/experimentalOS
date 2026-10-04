<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Experimental OS project workflow

- The source of truth is `InigoLoperena/experimentalOS` on GitHub.
- The user explicitly requested that code changes be implemented and synchronized in this repository, rather than delivered only as ZIP archives or edits to a temporary folder. Their Windows folder is updated separately through GitHub Desktop Fetch/Pull.
- For this project the user has authorized updating `main` with requested changes after validation. Respect any later instruction to use branches or reviews instead. Never force-push over concurrent work.
- Preserve the six requested navigation sections and the simplified experiment fields. Keep experiments, GOI Trees and learnings scoped to projects.
- Use «Responsable» for record ownership. Attachments are stored separately from experiment fields and must remain private to the company; readers may view them but only owners/editors may modify them.
- Preserve the Imagine Builder logo and the full «Experimental Operative System» title. Use the logo's charcoal gray, lime green, red and blue brand palette; do not restore the old star beside the product name.
- Run appropriate validation before publishing code and report the resulting GitHub commit.
- Supabase migrations and authentication settings are separate from a Vercel code deployment. Do not claim they were applied unless verified. Give clear instructions for any remaining setup.
