# cocoatouch-for-web

The `cocoatouch` npm package: Apple's CocoaTouch for the browser. Every interface here carries Apple's exact name, arguments and semantics; nothing is added that Apple does not have. The sites that consume it (starkbank-docs, starkbank-home, starkinfra-home, starkbank-web) write only against these interfaces, so a need they have that Apple covers is met here, never with a shim in the site.

## Code

- One class per file under `src/<framework>/`, exported from that framework's `index.js`, which `src/UIKit.js`, `src/Foundation.js` and the other entry points make ambient.
- Names are Apple's: `setContentOffset(point, {animated})` for `setContentOffset(_:animated:)`, labels as object keys, `UIKeyCommand.input("k")` for `UIKeyCommand.input`. Everything that is not a type is lowerCamelCase, constants included (`keyboardPrefix`, never `KEYBOARD_PREFIX`).
- The DOM and jQuery live only in this package, behind the Apple surface. Stylesheet-facing state is a class or attribute the setter writes (`selected`, `disabled`, `href`), never something a site toggles itself.
- Every interface ships with a test in `test/*.test.js`; `npm test` runs them against the jQuery stand-in in `test/setup.js`, and also builds `types/` from the sources.
- A view owns one element and its nib fills it. An outlet's element is the one the owner's nib names, so that nib may have several top-level elements; a view created in code gets its single nib root as its element, and a nib with several roots gets a bare `<div>`. Do not reinstate copying the superview's classes onto that wrapper, and do not make it `display: contents`: both leave a view that cannot report its frame.
- Comments say why, not what.

## Git

- `master` is the released state. Never commit to it: cut `feature/<slug>` or `fix/<slug>` from the fresh `master` tip, push, open a PR against `master`, merge it as a merge commit (`gh pr merge --merge --delete-branch`), never squash or rebase-merge.
- Commit subjects are capitalized imperative sentences without prefixes; agent-authored commits end with the `Co-Authored-By` trailer.

## Releasing a version

A version is a PR, a tag, a GitHub release and an npm publish, in that order. Skipping the release leaves the tag out of the Releases page, where consumers look for what changed.

1. On the branch, set `"version"` in `package.json` to the new number (minor for new interfaces, patch for fixes) and note the interfaces in `README.md`.
2. Merge the PR as a merge commit, then `git checkout master && git pull --ff-only origin master`.
3. `npm test` on master must pass.
4. Tag and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. Create the release on the tag, titled `cocoatouch X.Y.Z`, with the npm link first and one bullet per interface, naming them the way Apple does:

    ```
    gh release create vX.Y.Z --title "cocoatouch X.Y.Z" --notes "https://www.npmjs.com/package/cocoatouch/v/X.Y.Z

    - UIScrollView.contentOffset, contentSize and setContentOffset(_:animated:).
    - ..."
    ```

6. `npm publish` (public access is set in `package.json`; `prepack` builds the types). Only the package maintainer publishes, and only when asked.
7. In each consumer, pin the exact version (`"cocoatouch": "X.Y.Z"`, not `^X.Y.Z`: the docs test suite compares the installed version with the pinned string) and commit on that site's branch.

Check the Releases page afterwards: `gh release list` must show the new version as Latest.
