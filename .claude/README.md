# .claude/ — Claude Code Configuration

This folder contains project-specific configuration for Claude Code.

## Structure

```
.claude/
├── README.md              # This file
├── CLAUDE.md              # Top-level project overview     
├── agents/                # Sub-agent definitions for specialized tasks
│   ├── api-agent.md       # API layer (src/api/) specialist
│   ├── ui-agent.md        # React/UI component specialist
│   └── feature-agent.md   # End-to-end feature scaffolding
├── commands/              # Custom slash command templates
│   ├── new-api-module.md  # Scaffold a new src/api/<domain>.js module
│   ├── new-page.md        # Scaffold a new page component + route
│   └── new-dialog-form.md # Scaffold a shadcn Dialog + react-hook-form
└── rules/                 # Project-specific coding conventions
    ├── api-conventions.md      # API layer patterns and rules
    ├── component-conventions.md # React component rules
    ├── supabase-patterns.md    # Supabase client usage
    ├── post-versioning.md      # Post/version data model explanation
    └── routing.md             # React Router structure and conventions
```

## How to Use

- **Agents**: Reference these when delegating work to a specialized sub-agent. Each agent file describes its role, constraints, and the patterns it should follow.
- **Commands**: Use as starting templates when creating new modules, pages, or forms. Adapt to the specific domain.
- **Rules**: Always consult the relevant rule file before writing code in that area of the codebase.

The top-level [CLAUDE.md] is the primary reference. These files provide deeper detail for specific topics.
