# CocoaTouch for Web

Apple's CocoaTouch, UIKit and Foundation, for the browser. Write a page as a `UIViewController` with `@IBOutlet` and `@IBAction` bindings and a `.xib` holding its html, the way you would in Xcode, and run it on jQuery.

```
src/uipages/home/
    index.js                 imports the other three files, exports the controller
    homeViewController.js    export class HomeViewController extends UIViewController
    homeViewController.css
    homeViewController.xib   plain html, attached to HomeViewController by name at build time
```

```js
import "UIKit"


export class HomeViewController extends UIViewController {

    @IBOutlet("#title", UILabel) titleLabel
    @IBOutlet("#open", UIButton) openButton

    viewDidLoad() {
        this.titleLabel.text = "Hello"
    }

    @IBAction("#open", UIButton) openButtonTapped(sender) {
        window.location.href = "/api"
    }

    @IBAction(Keyboard.command + Keyboard.k) commandKPressed() {
        window.location.href = "/search"
    }
}
```

## Install

```
npm install cocoatouch
```

`import "UIKit"` works like Swift's `import UIKit`: the framework's classes become ambient in the page, so files use `UIViewController`, `UILabel` or `@IBOutlet` unqualified. Point webpack at the framework names once:

```js
// webpack.config.js
resolve: {
    alias: require("cocoatouch/webpack/aliases"),
}
```

The same goes for `import "Foundation"`, `import "CoreAnimation"` and `import "AVKit"`. Named imports work too, from `"cocoatouch"` or from a framework entry such as `"cocoatouch/UIKit"`. The lowercase entries `cocoatouch/uikit` and friends export the same classes without touching globals.

Requirements:

- jQuery 3 available as the global `$` before the bundle runs.
- Babel with `@babel/plugin-proposal-decorators` in `legacy` mode and `@babel/plugin-proposal-class-properties`, for `@IBOutlet` and `@IBAction` in your own classes. The framework itself is plain ES2022.
- A `<cocoatouch></cocoatouch>` element in the page. Controllers present into it.

## Nibs

A `.xib` is the html of one view. The webpack loader attaches it to the class of the same name exported by the sibling `.js`, so `codeView.xib` becomes `CodeView.nib`. The link is an import emitted at build time, which survives minification.

```js
// webpack.config.js
{
    test: /\.xib$/,
    use: ["babel-loader", require.resolve("cocoatouch/webpack/xibLoader")],
}
```

A `.xib` without a sibling `.js`, or whose sibling does not export a class of that name, fails the build with a message naming both files.

## Lifecycle

```
present(controller)   viewDidLoad -> viewWillAppear -> viewDidAppear
                      the previous root controller first gets viewWillDisappear -> viewDidDisappear
restore(controller)   rebinds outlets and actions on pre-rendered html: viewWillAppear -> viewDidAppear
```

Views get `awakeFromNib` after their outlets are bound and `layoutSubviews` before their nib is inserted. `addSubview` and `addSubviews` link the child into the responder chain, so `view.next`, `view.superview`, `view.subviews` and `view.parentViewController()` work.

## Table views

A table view works the way it does on iOS: register a cell class for a reuse identifier, dequeue it in the data source, configure its outlets. The cell's row html lives in the `.xib` of the same name as the cell class.

```
src/uicomponents/transfers/
    transferCell.js      export class TransferCell extends UITableViewCell { @IBOutlet("#title", UILabel) titleLabel }
    transferCell.xib     <tr><td id="title"></td></tr>
```

```js
this.tableView.register(TransferCell, {forCellReuseIdentifier: "transfer"})
this.tableView.dataSource = this

tableViewNumberOfRowsInSection(tableView, section) {
    return this.transfers.length
}

tableViewCellForRowAtIndexPath(tableView, indexPath) {
    var cell = tableView.dequeueReusableCell({withIdentifier: "transfer", for: indexPath})
    cell.titleLabel.text = this.transfers[indexPath.row].name
    return cell
}
```

`selectRow({at})`, `deselectRow({at})`, `indexPathForSelectedRow`, `indexPathsForSelectedRows`, `allowsMultipleSelection`, `setEditing(true)` and `cellForRow({at})` behave as on iOS. The delegate receives `tableViewDidSelectRowAtIndexPath`, `tableViewDidDeselectRowAtIndexPath` and, in editing mode, `tableViewCommitEditingStyleForRowAt(tableView, "delete", indexPath)`. `UICollectionView` follows the same shape with `IndexPath` sections and items.

## Controls

- `UIButton`: `showsActivityIndicator = true` swaps the title for a spinner and disables the button until set back; `icon = {position, icon, text}` places an icon beside the title.
- `UITextField`: the delegate gets `textFieldDidBeginEditing`, `textFieldDidEndEditing` and `textFieldShouldReturn`; `isFirstResponder`, `becomeFirstResponder()`, `resignFirstResponder()`.
- `UISearchTextField`: tokens with `insertToken`, `removeToken`, `removeAllTokens`, validation, paste handling, keyboard selection; the delegate gets `tokensUpdated`, `textFieldWillInsertText` and `textFieldDidPaste`. Selected tokens use the view's `tintColor`, which defaults to the page's `--action-or-selection-color` token.
- `UIDatePicker`: `date`, `minimumDate`, `maximumDate`, `locale`, `datePickerMode = "yearAndMonth"`; wraps the jQuery UI datepicker, so `jquery-ui` must be on the page where it is used.
- `UIDevice.current`: `model`, `platform`, `userInterfaceIdiom`.
- `UITapGestureRecognizer({target, action})` with `view.addGestureRecognizer(recognizer)`.
- Foundation: `DispatchGroup` (`enter`, `leave`, `notify`), `IndexPath({row, section})`, `Locale(identifier)` with date formats and datepicker regional strings.

Views get an `init()` hook that runs when the object is constructed, before any nib is attached. `UILabel.text` and friends sanitize through DOMPurify when the page loads it, and strip scripts otherwise.

`cocoatouch/uikit.css` carries the few styles the controls need; import it once.

## Notifications

`NSNotificationCenter` is observer keyed. Pass a DOM event target as `object` to observe that event; leave it out to post and observe in-app notifications.

```js
NSNotificationCenter.addObserver(this, {name: "scroll", object: window, selector: () => this.updateMenu()})
NSNotificationCenter.addObserver(this, {name: "cartDidChange", selector: "cartDidChange"})
NSNotificationCenter.postNotification({name: "cartDidChange", userInfo: {count: 3}})
NSNotificationCenter.removeObserver(this)
```

Everything a view or controller observes is released when its root controller is dismissed, so window and document listeners never pile up across navigations. Keyboard `@IBAction`s register the same way.

## Editor and linter support

The ambient names are declared, so an editor can still jump to `UIViewController`, complete its members and underline a typo before the build does. The package ships generated `.d.ts` files for every entry plus `types/globals.d.ts` for the names `import "UIKit"` makes ambient. In a JavaScript project, point `jsconfig.json` at them once:

```json
{
    "compilerOptions": {
        "checkJs": true,
        "experimentalDecorators": true,
        "paths": {
            "UIKit": ["./node_modules/cocoatouch/types/UIKit.d.ts"],
            "Foundation": ["./node_modules/cocoatouch/types/Foundation.d.ts"]
        }
    },
    "files": ["node_modules/cocoatouch/types/globals.d.ts"],
    "include": ["src"]
}
```

For ESLint, `cocoatouch/eslint/globals` exports the same names as a `globals` object, so `no-undef` accepts them and still flags misspellings.

## Server side rendering

Capture the `<cocoatouch>` inner html after `present`, serve it with `window.__PRERENDERED = true`, and call `controller.restore(controller)` instead of `present`. Outlets and actions rebind to the existing DOM, and views added at runtime through `addSubview` are found again by their `@IBAction` selectors.

## Classes

| Foundation | UIKit | Other |
|---|---|---|
| NSObject | UIResponder, UIView, UIViewController | CALayer |
| NSNotificationCenter | UIControl, UIButton, UILabel, UIScriptLabel, UITextField | AVPlayer |
| | UIImageView, UIImage, UIColor, UIControlEvent | |
| | UIScrollView, UITableView, UITableViewCell | |
| | UIPickerView, UISegmentedControl, UISwitch | |
| | UIProgressView, UIActivityIndicatorView | |
| | IBOutlet, IBAction, Keyboard | |

## Sample

`sample/` is a small app with a menu of pages, one per part of UIKit: buttons, labels, text fields, a custom view with its own nib, and a table view with a custom cell. It depends on this package through `file:..`, so it runs against the working tree.

```
cd sample
npm install
npm start
```

Then open http://localhost:8080.

## Tests

```
npm test
```
