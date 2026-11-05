# Third-party notices

The independently authored app is MIT licensed. It imports these real, pinned npm
dependencies; their source was not copied into the application as a claimed new
framework or diff algorithm.

| Dependency | Version | License / retained original |
|---|---|---|
| [BuilderIO/agent-native](https://github.com/BuilderIO/agent-native) `@agent-native/core` | 0.223.0 | MIT, copyright 2026 Builder.io, Inc.; [full original](licenses/agent-native-MIT.txt) |
| [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) `diff` | 9.0.0 | BSD-3-Clause, Kevin Decker and contributors; [full original](licenses/jsdiff-BSD-3-Clause.txt) |
| [colinhacks/zod](https://github.com/colinhacks/zod) `zod` | 4.4.3 | MIT, Colin McDonnell; [full original](licenses/zod-MIT.txt) |

`package-lock.json` pins the dependency graph and package integrity. npm installs
transitive packages with their original license files; those packages do not
become MIT just because this app is MIT. `docs/source-versions.json` records npm
release integrity and comparison source versions. No `node_modules` or copied
third-party assets are distributed in the source/build artifact. VS Code was
compared only; its code, artwork and Microsoft product binaries were not copied.
