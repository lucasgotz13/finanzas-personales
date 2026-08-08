# Skill Registry

Generated: 2026-08-08
Project: finanzas-personales
Scope: user-level skills (greenfield project — no project-local skills yet)

> This registry is an INDEX only. Subagents receive exact paths and must read the
> full `SKILL.md` file as the source of truth — never a summary.

## User Skills

| Skill | Trigger | Path |
|---|---|---|
| branch-pr | Creating, opening, or preparing PRs for review | /home/gotzl/.config/opencode/skills/branch-pr/SKILL.md |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | /home/gotzl/.config/opencode/skills/chained-pr/SKILL.md |
| cognitive-doc-design | Writing guides, READMEs, RFCs, onboarding, architecture, review-facing docs | /home/gotzl/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| comment-writer | PR feedback, issue replies, reviews, Slack messages, GitHub comments | /home/gotzl/.config/opencode/skills/comment-writer/SKILL.md |
| find-skills | "how do I do X", "find a skill for X", extending capabilities | /home/gotzl/.agents/skills/find-skills/SKILL.md |
| go-testing | Go tests, go test coverage, Bubbletea teatest, golden files | /home/gotzl/.config/opencode/skills/go-testing/SKILL.md |
| issue-creation | Issue creation, bug reports, feature requests, issue approval | /home/gotzl/.config/opencode/skills/issue-creation/SKILL.md |
| judgment-day | Judgment day, dual review, adversarial review, juzgar | /home/gotzl/.config/opencode/skills/judgment-day/SKILL.md |
| nodejs-backend-patterns | Node.js servers, REST APIs, GraphQL backends, microservices | /home/gotzl/.agents/skills/nodejs-backend-patterns/SKILL.md |
| omarchy | Hyprland, waybar, walker, terminal/desktop config, omarchy commands | /home/gotzl/.local/share/omarchy/default/omarchy-skill/SKILL.md |
| skill-creator | New skills, agent instructions, documenting AI usage patterns | /home/gotzl/.config/opencode/skills/skill-creator/SKILL.md |
| skill-improver | Improve skills, audit skills, refactor skills, skill quality | /home/gotzl/.config/opencode/skills/skill-improver/SKILL.md |
| work-unit-commits | Commit planning, commit splitting, chained PRs, keeping tests/docs with code | /home/gotzl/.config/opencode/skills/work-unit-commits/SKILL.md |

## Excluded from Index

- `sdd-*` pipeline skills (sdd-init, sdd-explore, sdd-propose, sdd-spec, sdd-design,
  sdd-tasks, sdd-apply, sdd-verify, sdd-archive, sdd-onboard) — orchestrated by the SDD loop.
- `_shared` — shared SDD references, not invokable.
- `skill-registry` — this index's own generator.
- `customize-opencode` — built-in skill, no file path.

## Project Convention Files

- None yet (greenfield — no AGENTS.md / CLAUDE.md / .cursorrules in project root).
- User-level convention file present: /home/gotzl/.config/opencode/AGENTS.md
