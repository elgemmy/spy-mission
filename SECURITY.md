# Security Policy

## Supported versions

Security fixes are accepted against the latest `main` branch and the production
deployment at [https://spymission.dev](https://spymission.dev).

Older commits, preview deployments, and local design-preview builds are not
supported.

## Reporting a vulnerability

Please report vulnerabilities **privately**. Do not open a public issue.

Use GitHub’s private vulnerability reporting:

[Open a private security advisory](https://github.com/elgemmy/awesome-codenames/security/advisories/new).

Include enough detail to reproduce the issue. Do **not** attach production
secrets, API keys, service-role credentials, or private invite tokens.

We will acknowledge the report and work on a fix before any public disclosure.

## Secrets in this repository

Never commit real credentials. Use `.env.local` from `.env.example`. Never
publish secrets in issues, pull requests, or screenshots.
