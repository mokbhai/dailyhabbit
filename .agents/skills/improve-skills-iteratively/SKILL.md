---
name: improve-skills-iteratively
description: Use when creating or updating repo-local Codex skills from repeated user prompts, communication patterns, task friction, review feedback, or explicit requests to improve how future agents handle JainParichay template-jp work. Guides evidence-based skill iteration, validation, and AGENTS.md updates without overfitting to one conversation.
---

# Improve Skills Iteratively

## Overview

Use this skill to keep the repo's skills accurate as real conversations reveal missing guidance, confusing triggers, repeated corrections, or recurring workflow friction. The goal is a small durable improvement, not a transcript summary.

## Start From Evidence

Capture the concrete signal before editing:

- the user prompt, review comment, or communication pattern that exposed the gap.
- the behavior future agents should change.
- the affected skill files under `.agents/skills`, or why no existing skill fits.
- whether `AGENTS.md` needs a global rule, or whether the behavior belongs only inside a specific skill.

Do not generalize from a one-off preference unless the user explicitly asks to make it a standing rule. If the signal is ambiguous, preserve the narrowest interpretation and state the assumption in the final handoff.

## Choose The Smallest Change

Prefer updating an existing skill when the behavior belongs to an established workflow. Create a new skill only when the trigger is distinct enough that future agents should discover it independently.

Use these boundaries:

- `AGENTS.md`: repository-wide behavior that should apply even when no skill triggers.
- `SKILL.md` frontmatter description: trigger conditions and scope. Include all "when to use" signals here.
- `SKILL.md` body: concise workflow instructions, decision rules, validation, and failure modes.
- `agents/openai.yaml`: human-facing metadata that must stay aligned with the skill.
- `scripts/`, `references/`, or `assets/`: only when repeated execution or bulky reference material would otherwise be re-created.

Avoid duplicating the same guidance across multiple skills. If two skills need the same rule, consider whether it is really an `AGENTS.md` rule or whether one skill should point to the other.

## Iteration Workflow

1. Inspect the current skill inventory with `find .agents/skills -maxdepth 3 -type f -print | sort`.
2. Read the affected `SKILL.md` files and their `agents/openai.yaml` metadata.
3. Decide whether to edit an existing skill or scaffold a new one with `skill-creator`.
4. Make the smallest evidence-backed change that would have helped on the triggering prompt.
5. Update `agents/openai.yaml` when the skill name, scope, or default prompt changes.
6. Update `AGENTS.md` only for durable repository-wide expectations.
7. Validate the changed skill with this skill's bundled validator.
8. Report changed files, validation, and any deliberate limits.

## Writing Rules

- Keep skills concise and imperative.
- Prefer concrete decision rules over broad motivational language.
- Name likely failure modes when they affect correctness, performance, reliability, or maintainability.
- Include exact commands only when they are stable for this repo.
- Preserve two-space TypeScript style, PNPM/Turbo conventions, and existing repo vocabulary when examples mention code.
- Do not add README files or extra documentation inside a skill unless a referenced resource is truly needed.

## Validation

Run the bundled validator:

```bash
python3 .agents/skills/improve-skills-iteratively/scripts/quick_validate.py .agents/skills/<skill-name>
```

The validator is copied from `skill-creator` so this workflow does not depend on a user-specific absolute path. If the upstream validator changes materially, update this copy deliberately rather than editing it opportunistically during unrelated skill work.

For a new or substantially changed skill, also do a quick self-check against a realistic prompt:

- Would the frontmatter description trigger at the right time?
- Is the body short enough to load without wasting context?
- Does it tell a future agent what to do, what to avoid, and how to validate?
- Did the change avoid silently rewriting unrelated user-owned work?
