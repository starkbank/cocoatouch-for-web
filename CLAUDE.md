# cocoatouch-for-web

The `cocoatouch` npm package: Apple's CocoaTouch for the browser. Every interface here carries Apple's exact name, arguments and semantics; nothing is added that Apple does not have. The sites that consume it (starkbank-docs, starkbank-home, starkinfra-home, starkbank-web) write only against these interfaces, so a need they have that Apple covers is met here, never with a shim in the site.

## Code

- One class per file under `src/<framework>/`, exported from that framework's `index.js`, which `src/UIKit.js`, `src/Foundation.js` and the other entry points make ambient.
- Names are Apple's: `setContentOffset(point, {animated})` for `setContentOffset(_:animated:)`, labels as object keys, `UIKeyCommand.input("k")` for `UIKeyCommand.input`. Everything that is not a type is lowerCamelCase, constants included (`keyboardPrefix`, never `KEYBOARD_PREFIX`).
- A delegate or data-source method is the Objective-C selector with the colons removed and each following piece capitalised, its arguments positional in Apple's order with the sender first (`tableViewNumberOfRowsInSection(tableView, section)`); this is the one exception to labels as object keys, optional methods are really optional, and a `Bool` return counts only when it is exactly `false`.
- The DOM and jQuery live only in this package, behind the Apple surface. Stylesheet-facing state is a class or attribute the setter writes (`selected`, `disabled`, `href`), never something a site toggles itself.
- Every interface ships with a test in `test/*.test.js`; `npm test` runs them against the jQuery stand-in in `test/setup.js` or, for files that import `test/dom.js`, a jsdom document with the real jQuery, and also builds `types/` from the sources.
- A view's nib describes the view's contents when the view has a host element, and the view itself when it does not. A view owns one element and its nib fills it. An outlet's element is the one the owner's nib names, so that nib may have several top-level elements; a view created in code gets its single nib root as its element, and a class nib with several roots is refused with an error naming the count; only an empty nib or `UIView.loadFromNib` html still gets a bare `<div>`. Do not reinstate copying the superview's classes onto that wrapper, and do not make it `display: contents`: both leave a view that cannot report its frame.
- Every lifecycle hook has its order written in README §Lifecycle (`present`, `restore`, an outlet-bound controller, `addSubview`, `removeFromSuperview`, containment, a root swap, a resize); a new hook lands in the same commit as the sentence that places it, and a test asserts the whole sequence with `deepEqual`.
- The framework never resolves its own stored state through a public method on `this` when a module-private function will do: Swift lets a subclass hold `var title` beside `title(for:)`, JavaScript has one namespace, and a subclass property sharing an Apple method's base name must not be able to break the superclass.
- A label Apple requires is required here: an option Apple's signature makes mandatory gets no default, and its absence throws a `TypeError` naming the method and the Swift signature.
- Labelled arguments are destructured in the signature and typed with a JSDoc `@param` per label, never received as `options`: the declaration must show which labels a member takes and which of them Apple requires, and the shared `required()`/`typed()` guards check the type as well as the presence.
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
