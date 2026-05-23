# Project Status

This repository is a frozen prototype and local fallback for Talk to Figma MCP workflows.

## Current Positioning

Talk to Figma MCP Lite is not trying to replace the official Figma MCP server. Official Figma MCP is the better default for broad production-grade Figma read/write workflows, especially when you need remote access, variables, components, Code Connect, or official support.

This repository remains useful as:

- a local Figma plugin + WebSocket relay reference
- a smaller MCP facade over the original unofficial Talk to Figma tool surface
- a testbed for `inspect -> preview -> apply -> verify` agent workflows
- a fallback for local/self-hosted experiments
- an attribution-preserving fork of the original community work

## What Is Complete

The Lite MVP includes:

- `figma_session`
- `inspect_design`
- `create_nodes`
- `update_nodes`
- `manage_text`
- `view_and_export`
- focused Bun tests for the Lite planner/facade
- setup, workflow, original-tool, and lineage documentation

The project has been smoke-tested against a local Figma plugin and relay workflow.

## What Is Intentionally Out Of Scope

The project does not aim to add:

- a replacement for official Figma MCP write-to-canvas
- a full Figma variable/component/Code Connect system
- a production hosted relay or auth system
- a new bundled Figma plugin architecture
- a general design-generation product
- `DESIGN.md` orchestration inside this repo

## Maintenance Policy

Reasonable future changes:

- fix broken setup docs
- fix local development compatibility issues
- fix bugs in existing Lite facade behavior
- improve tests for existing Lite planner functions
- correct license or attribution details
- document limitations clearly

Changes that should usually happen elsewhere:

- new product direction
- official Figma MCP wrapper work
- `DESIGN.md`-driven Figma/web sync
- large rewrites of the plugin or relay
- broad feature expansion beyond local fallback use

## Relationship To Future Work

Future `DESIGN.md` sync work should live in a separate project. This repository can still inform that work through:

- its local adapter experience
- its normalized response shape
- its preview-first safety model
- its original MCP tool mapping

Treat this codebase as a completed reference, not the main product surface.
