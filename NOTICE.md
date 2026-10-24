# Third-party notices

## Arcanic Visuals (GPL-3.0)

`mod-fabric/arcanic-1.21.11/` is a copy of the **Arcanic Visuals** source tree:

- Project: Arcanic Visuals — a free and open-source visual client for Minecraft 1.21.11
- Source: https://github.com/arcanic-su/arcanic
- Copyright (c) 2026 Arcanic
- License: GNU General Public License v3.0 — full text in
  [`mod-fabric/arcanic-1.21.11/LICENSE`](mod-fabric/arcanic-1.21.11/LICENSE)

WinVisual bundles and builds this code as the 1.21.11 client core. All files keep
their original copyright headers.

Because Arcanic Visuals is distributed under the GPL v3, **the combined work that
includes `mod-fabric/arcanic-1.21.11/` is also licensed under the GPL v3**. If you
publish binaries built from it, you must publish the corresponding source as well,
keep it under the GPL v3, and state that it is based on Arcanic Visuals.

### Bundled jar-in-jar dependencies

| Component | License | Upstream |
|---|---|---|
| Player Animation Library (`pal_version=1.1.10+mc.1.21.11`) | MIT | https://repo.redlance.org/public |
| ImmediatelyFast 1.14.3+1.21.11 | LGPL-3.0 | https://modrinth.com/mod/immediatelyfast |
| Optimizer Mod 1.0.3 (`libs/optimizermod-1.0.3.jar`) | see `libs/NOTICE.txt` | bundled |
| Fabric API 0.141.6+1.21.11 | Apache-2.0 | https://github.com/FabricMC/fabric |

Minecraft itself is not distributed here and remains under Mojang/Microsoft terms.

## Other bundled components

- `third-party/` retains the original upstream notices from the Arcanic tree.
- Fonts in `src/main/resources/assets/**/font/` ship with the Arcanic tree under
  their own licences; see the original repository for details.
