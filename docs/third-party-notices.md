# Third-party notices and project licensing

This is an attribution/inventory document, not a replacement for upstream license texts or a new license for the project.

## Project code and assets

No root LICENSE file was present in the AKM-31 base checkout (main 19c7b4e). The team still needs to select/authorize a project license before promising an open-source grant or completing a submission that requires one. Public GitHub visibility is not itself a license. This task does not unilaterally assign rights.

The interface uses CSS/system-font fallbacks and text symbols. The font stack begins with Inter but no Inter font file is included or downloaded by this checkout. No NASA logo, external photograph, video or separately packaged icon/font asset was found in the tracked application assets. Versioned evidence PNGs are captures of the fictional application. Do not infer rights for future assets from this inventory.

NASA historical data and linked web content have their own terms; see [data sources](data-sources.md). Referencing NASA does not imply NASA endorsement. NASA image/brand guidance is separate from the mission-data policy.

## Libraries

[Machine-readable inventory](dependency-inventory.json) records Python distribution metadata from the clean AKM-31 environment and npm package-lock metadata. It includes transitive dependencies, not just the table below. Metadata is evidence of declared licensing, not a complete legal review. Preserve upstream LICENSE/NOTICE files when redistributing package code or binary artifacts.

| Direct dependency / tool | Declared license | Local source of evidence |
| --- | --- | --- |
| FastAPI, SQLModel | MIT | Installed Python metadata/license files |
| Uvicorn | BSD-3-Clause | Installed Python metadata/license files |
| Pytest | MIT | Installed Python metadata/license files |
| HTTPX | BSD-3-Clause | Installed Python metadata/license files |
| Ruff | MIT | Installed Python metadata/license files |
| React, React DOM | MIT | frontend/package-lock.json and installed LICENSE |
| TypeScript | Apache-2.0 | frontend/package-lock.json and installed license |
| Vite, @vitejs/plugin-react | MIT | frontend/package-lock.json and installed licenses |
| @types/react, @types/react-dom | MIT | frontend/package-lock.json |

Important transitive licenses in the Python environment include Pydantic/SQLAlchemy (MIT), Starlette (BSD-3-Clause), certifi (MPL-2.0), OpenTelemetry API (Apache-2.0), packaging (Apache-2.0 OR BSD-2-Clause) and typing_extensions (PSF-2.0). The npm graph includes additional license expressions; consult the inventory and actual distributed package files.

Python, Node.js, npm, browsers and SQLite are external runtime/tool distributions with their own notices. SQLite's upstream [copyright statement](https://www.sqlite.org/copyright.html) describes its public-domain status. No claim is made that every component in a Node/Python binary shares one license.

## Reinspect after changes

- Install from requirements-dev.txt and frontend/package-lock.json as in the README.
- Inspect Python distribution metadata with importlib.metadata; examine bundled license files where identifiers are absent.
- Inspect npm package-lock license fields and each distributed package's LICENSE/NOTICE. Missing metadata is a gap, not permission.
- Reconcile versions with [AKM-31 verification](akm-31-verification.md); Python version ranges may resolve differently on future installs.
- Preserve NASA credit, source links, excerpt interval and transformations. Audit newly downloaded artifacts before redistribution.
- Recheck new media/fonts/icons and reconcile every contributor's [AI/tool disclosure](ai-usage.md) before submission.

No external rendering/visual library, Recharts or lucide-react is declared in the current frontend package.json. Earlier architecture proposals mentioning them do not establish an installed dependency.
