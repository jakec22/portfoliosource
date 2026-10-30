# Vendored: impeccable 4.8.0

`skills/impeccable/`, `agents/impeccable-*.md` and the hooks in `settings.json`
are a copy of the [impeccable](https://github.com/pbakaus/impeccable) plugin,
checked in rather than installed.

## Why it's a copy

A cloud session doesn't install the plugins a repository turns on under
`enabledPlugins`, or the ones from marketplaces it lists under
`extraKnownMarketplaces` — those keys are read and then ignored. What a cloud
session *does* load from the clone is `.claude/skills/`, `.claude/agents/` and
`.claude/settings.json` hooks. The plugin is made of exactly those three
things and no MCP server, so copying its parts into the places that load gets
the whole plugin into cloud sessions.

The hooks all invoke `skills/impeccable/scripts/impeccable`, which travels with
the skill; only the path prefix changed, from `${CLAUDE_PLUGIN_ROOT}` to
`${CLAUDE_PROJECT_DIR}/.claude`. Each one is guarded with `[ ! -f … ] ||`, so a
wrong path makes them no-ops rather than failures.

## Why it's at the repository root

Claude Code reads `.claude/settings.json` from the session's primary working
directory. A cloud session's is the repository root, not `MacroTracker/`, so
`MacroTracker/.claude/settings.json` is never read in one — which is also why
the `expo` plugin it enables has never loaded in a cloud session.

Starting Claude Code from inside `MacroTracker/` locally reads that file and
not this one.

## Keeping it current

This is a snapshot, pinned at whatever was published when it was copied. It
does not auto-update the way an installed plugin does. To move to a newer
version:

```sh
claude plugin install impeccable --marketplace pbakaus/impeccable
cp -r ~/.claude/plugins/cache/impeccable/impeccable/<version>/skills/impeccable \
      .claude/skills/impeccable
cp ~/.claude/plugins/cache/impeccable/impeccable/<version>/agents/*.md \
      .claude/agents/
```

Then re-check `hooks/hooks.json` in that version against the hooks here, in
case they changed.

Installing it properly on your own machine is still worth doing: local sessions
then get the auto-updating version, and the two don't conflict.
