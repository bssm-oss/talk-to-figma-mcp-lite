# Security Policy

## Supported Scope

This repository is a local prototype and fallback workflow. Security fixes are accepted for the current local MCP server, WebSocket relay, and Figma plugin code.

The project does not provide a hosted service, account system, or production multi-tenant deployment.

## Reporting A Vulnerability

Please report suspected vulnerabilities privately through GitHub security advisories when available, or by opening a minimal issue that avoids exploit details and asks for a private contact path.

Include:

- affected file or component
- steps to reproduce
- expected impact
- whether the issue requires local access, Figma file access, or network access
- any relevant MCP client or Bun version

Do not include secrets, access tokens, private Figma file data, or private workspace URLs in public issues.

## Local Risk Model

This project connects an MCP client, a local WebSocket relay, and a Figma plugin. Treat it as local development tooling, not hardened infrastructure.

Important risks:

- the relay is intended for local use
- Figma commands mutate the open Figma file
- exported image payloads can contain private design data
- local `.mcp.json` files may contain machine-specific paths
- MCP clients can invoke powerful tools if configured to do so

## Recommended Usage

- Run the relay only on trusted machines.
- Use test or duplicate Figma files for experiments.
- Do not expose the relay publicly without adding your own auth and network controls.
- Keep `.env`, `.mcp.json`, and local client configs out of commits unless intentionally shared.
- Review generated changes before applying broad or destructive Figma operations.

## Non-Security Issues

Setup problems, broken docs, and ordinary bugs can be reported through normal GitHub issues.
