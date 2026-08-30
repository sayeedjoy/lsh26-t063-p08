# Third-Party Licenses

This project is two independent apps (`backend/`, `frontend/`) each with their
own `package.json` and lockfile — see [`CLAUDE.md`](CLAUDE.md) for why. Listed
below is every package each one declares directly under `dependencies` (not
`devDependencies` — build-only tooling like `typescript`, `vite`, `eslint`,
`tsx` and `prettier` never ships in a running app). Versions are what each
lockfile currently resolves to. All of it is permissively licensed; nothing
here is copyleft.

## `backend/`

One runtime dependency. The engine itself (`src/engine/`) imports nothing —
see *Tech Stack* in [`docs/spec.md`](docs/spec.md).

| Package | Version | License | Source |
|---|---|---|---|
| [`pg`](https://www.npmjs.com/package/pg) | 8.23.0 | MIT | https://github.com/brianc/node-postgres |

## `frontend/`

| Package | Version | License | Source |
|---|---|---|---|
| [`react`](https://www.npmjs.com/package/react) | 19.2.8 | MIT | https://github.com/facebook/react |
| [`react-dom`](https://www.npmjs.com/package/react-dom) | 19.2.8 | MIT | https://github.com/facebook/react |
| [`@base-ui/react`](https://www.npmjs.com/package/@base-ui/react) | 1.7.0 | MIT | https://github.com/mui/base-ui |
| [`shadcn`](https://www.npmjs.com/package/shadcn) | 4.19.0 | MIT | https://github.com/shadcn-ui/ui |
| [`lucide-react`](https://www.npmjs.com/package/lucide-react) | 1.37.0 | ISC | https://github.com/lucide-icons/lucide |
| [`class-variance-authority`](https://www.npmjs.com/package/class-variance-authority) | 0.7.1 | Apache-2.0 | https://github.com/joe-bell/cva |
| [`clsx`](https://www.npmjs.com/package/clsx) | 2.1.1 | MIT | https://github.com/lukeed/clsx |
| [`tailwind-merge`](https://www.npmjs.com/package/tailwind-merge) | 3.6.0 | MIT | https://github.com/dcastil/tailwind-merge |
| [`tailwindcss`](https://www.npmjs.com/package/tailwindcss) | 4.3.3 | MIT | https://github.com/tailwindlabs/tailwindcss |
| [`@tailwindcss/vite`](https://www.npmjs.com/package/@tailwindcss/vite) | 4.3.3 | MIT | https://github.com/tailwindlabs/tailwindcss |
| [`tw-animate-css`](https://www.npmjs.com/package/tw-animate-css) | 1.4.0 | MIT | https://github.com/Wombosvideo/tw-animate-css |
| [`@fontsource-variable/archivo`](https://www.npmjs.com/package/@fontsource-variable/archivo) | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files |
| [`@fontsource-variable/public-sans`](https://www.npmjs.com/package/@fontsource-variable/public-sans) | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files |
| [`@fontsource/ibm-plex-mono`](https://www.npmjs.com/package/@fontsource/ibm-plex-mono) | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files |

`tailwindcss` and `@tailwindcss/vite` run only at build time (the Vite plugin
and its CLI); `shadcn` is a scaffolding CLI invoked during development to add
component source into this repo. Neither ships inside `server.mjs`'s runtime —
see *Sharing the engine* and *Docker / hosting* in [`README.md`](README.md).
The three `@fontsource*` packages bundle font files under the SIL Open Font
License 1.1, not source code under MIT/ISC/Apache — OFL permits bundling,
modification and redistribution, including commercially, and requires no
attribution beyond this notice.

## This repository's own code

No `LICENSE` file is published at the repo root; this is a hackathon
submission (see [`EVENT.md`](EVENT.md)) governed by the competition's own
terms, not an independently licensed open-source release.
