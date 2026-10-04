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

    @IBAction(UIKeyModifierFlags.command + UIKeyCommand.input("k")) commandKPressed() {
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

The same goes for `import "Foundation"`, `import "CoreGraphics"`, `import "CoreAnimation"`, `import "CoreMedia"` and `import "AVKit"`; `import "UIKit"` brings Core Graphics along, as it does in Swift. Named imports work too, from `"cocoatouch"` or from a framework entry such as `"cocoatouch/UIKit"`. The lowercase entries `cocoatouch/uikit` and friends export the same classes without touching globals.

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

A view owns one element, and its nib fills that element. For a view declared as an `@IBOutlet`, the element is the one the outlet names in the owner's nib, so its own nib may have any number of top-level elements: they become the view's children, the way a xib's objects become a view's subviews. For a view created in code and placed with `addSubview`, there is no element yet: a nib with one root makes that root the view's element, so the classes the superview lays out by go on it; a nib with several roots gets a plain `<div>` the stylesheet cannot address. Give a view you create in code a single root.

A nib configures the view it draws through `@IBInspectable`, Interface Builder's user-defined runtime attributes: `@IBInspectable title` reads `data-title` off the view's own element into `title`, `@IBInspectable(UIColor) titleColor` reads `data-title-color` and converts it, and the value lands after the outlets are connected and before `awakeFromNib`, so `awakeFromNib` sees the configured view. The name maps lowerCamelCase to dashes. The types are the ones Interface Builder inspects: `String` (the default), `Number`, `Boolean` (`"true"` or `"false"`, anything else throws), `UIColor` (`#…` is a hex color, any other value a token resolved like `UIColor(named:)`), `UIImage` (`UIImage(named:)`), `CGPoint` and `CGSize` (two comma-separated numbers) and `CGRect` (four). A malformed number or boolean throws, naming the property; an absent attribute leaves the field's declared default standing.

```js
export class BannerView extends UIView {

    @IBInspectable title = "Untitled"
    @IBInspectable(UIColor) titleColor = UIColor.black
    @IBInspectable(Boolean) isWide = false

    awakeFromNib() {
        this.titleLabel.text = this.title
        this.titleLabel.textColor = this.titleColor
    }
}
```

```html
<div id="hero-banner" data-title="Pix" data-title-color="accent-color" data-is-wide="true"></div>
```

## Lifecycle

```
present(controller)   viewDidLoad -> viewWillAppear -> viewDidAppear
                      the previous root controller first gets viewWillDisappear -> viewDidDisappear
restore(controller)   rebinds outlets and actions on pre-rendered html: viewWillAppear -> viewDidAppear
```

Views get `awakeFromNib` after their outlets are bound, `layoutSubviews` before their nib is inserted and `didMoveToWindow` when a pre-rendered page is restored. `addSubview` links the child into the responder chain, so `view.next`, `view.superview`, `view.subviews` and `view.parentViewController()` work.

`awakeFromNib` is sent exactly once, and only after the view is fully initialised: a view the framework creates, as an outlet, a dequeued cell or a subview placed with `addSubview`, is bound and awoken by its creator once `new` has returned, so its class fields hold their declared values inside `awakeFromNib`. Three consequences. `init()` runs before the subclass's field initialisers in every case, since it is called from `UIView`'s constructor. A view the app constructs on an existing empty element, `new SecureTextField("#password")`, is bound and awoken by its own constructor, so there `awakeFromNib` runs before the subclass's fields; a class that needs its own fields in `awakeFromNib` should be created without a selector and placed with `addSubview`. And a subclass must pass the selector it receives to `super` unchanged, or the framework will treat it as an app-constructed view and bind it in its constructor as well as in its creator.

## Child view controllers

A controller composes others the way UIKit's containment API does: add the child, then put its view in one of your container views. The container element becomes the child's root, its nib fills it, its outlets and actions bind inside it and `viewDidLoad -> viewWillAppear -> viewDidAppear` run. Removing the child empties the container, runs `viewWillDisappear -> viewDidDisappear` and releases the observers it registered.

```js
class OnboardViewController extends UIViewController {

    @IBOutlet("#content", UIView) contentView

    show(step) {
        if (this.current) { this.current.removeFromParent() }
        this.current = new step()
        this.addChild(this.current)
        this.contentView.addSubview(this.current.view)
    }
}
```

`children`, `parent`, `willMove({toParent})` and `didMove({toParent})` follow UIKit. A plain view's `removeFromSuperview()` takes its element out of the page.

## Animations

`UIView.animate` runs property changes over a duration: `alpha` and `isHidden` fade instead of switching. `UIView.transition` swaps two views, sliding the new one in from the side named by a flip option or dissolving it.

```js
const card = UIView.loadFromNib(html)
this.listView.insertSubview(card)
card.alpha = 0
UIView.animate({withDuration: 0.5, animations: () => { card.alpha = 1 }})

UIView.transition({from: this.searchView, to: this.passwordView, duration: 0.28, options: [UIView.AnimationOptions.transitionFlipFromRight]})
```

`insertSubview(view, {at})` places a view's nib inside another view without restyling it; `tag` keeps an integer on a view; `accessibilityIdentifier` reads or sets a view's element id; `accessibilityLabel` is an image's alt text; an outlet matched by class is given `<owner id>-<outlet name>` and a subview added in code `<superview id>-<n>`, so nib-drawn views stay addressable without the app naming them; `UIControl.sendActions({for})` fires a control event; key commands reach the deepest bound responder that contains the focused element first and climb to the enclosing ones only when the handler returns `false`; and a view class with a `.xib` fills the empty element it is created on, so `new SecureTextField("#password")` renders like the outlet would.

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

`selectRow({at})`, `deselectRow({at})`, `indexPathForSelectedRow`, `indexPathsForSelectedRows`, `allowsMultipleSelection`, `setEditing(true)` and `cellForRow({at})` behave as on iOS. `dequeueReusableCell` hands back the cell object already bound to that row for the identifier, after sending it `prepareForReuse()`, and `reloadData` releases the cells a pass no longer uses, so a table reloaded on every filter holds one cell per row. The delegate receives `tableViewDidSelectRowAtIndexPath`, `tableViewDidDeselectRowAtIndexPath` and, in editing mode, `tableViewCommitEditingStyleForRowAt(tableView, "delete", indexPath)`. `UICollectionView` follows the same shape with `IndexPath` sections and items.

## Controls

- `UIControl`: `isEnabled = false` blocks the pointer and sets the `disabled` attribute; `isSelected` is the `selected` class. Both are there for stylesheets to draw. `addTarget(target, {action, for})` accumulates, as on iOS: a second pair never removes the first, nor an `@IBAction` bound to the same element, and the action runs on its target with `(target, control, event)`; `removeTarget(target, {action, for})` removes one pair, or every action that target registered for the event when `action` is omitted. An `@IBAction` matched by class gives an id-less element `<owner id>-<action name>-<n>`, so the sender it hands over stays addressable.
- `UIImageView`: `image` is the source of an `<img>`, `<video>` or `<lottie-player>` and the CSS background of any other element. `UIImage({systemName})` is an icon font symbol: its classes replace the previous symbol's on the element.
- `userActivity`: a view whose `NSUserActivity` has a `webpageURL` is a link to that page, so the url is written as the element's `href`. Set it where iOS would open a page on tap, and keep the `<a>` in the nib. Read on a view bound to an anchor that already has an href, it is that page as a browsing activity, so an `@IBAction` sender can navigate with `sender.userActivity.webpageURL`.
- `UIScrollView`: `contentOffset`, `contentSize` and `setContentOffset(_:animated:)` read and move the element's scroll position.
- Key commands: an `@IBAction` on a single character with no modifiers is typed into a focused text input instead of firing, as a `UIKeyCommand` is consumed by a first responder text field on iOS. Modified commands and non-character keys still fire.
- `UILabel`: `adjustsFontSizeToFitWidth` shrinks the font on one line until the text fits, no further than `minimumScaleFactor`; `textColor` takes a `UIColor`.
- `UIButton`: `setTitleColor(color, {for: state})` and `titleColor({for: state})`.
- `viewWillTransition({to: size, with: coordinator})` runs on the root controller and its children when the window changes size, and every view bound to them gets `layoutSubviews()`, so a layout that depends on width is redone there; `UIScreen.main.bounds` reads the viewport.
- `UIHoverGestureRecognizer`: added with `view.addGestureRecognizer`, its action runs with `state` `.began`, `.changed` and `.ended` as a mouse pointer enters, moves over and leaves the view; touches are not hovers, as on iPadOS. Recognizers expose `UIGestureRecognizer.State`.
- `UIColor`: `UIColor({named: "title-color"})` resolves the stylesheet's `--title-color` token, the way `UIColor(named:)` reads the asset catalog; `UIColor({red, green, blue, alpha})`, `UIColor({white, alpha})`, `UIColor.clear`, `.white` and `.black`. `cgColor` is the value a stylesheet understands.
- `UIView.frame` and `bounds`, and `UIScreen.main.bounds`, are `CGRect`s: `origin` (`CGPoint`), `size` (`CGSize`), `width`, `height`, `minX`, `minY`, `maxX`, `maxY`, `midX`, `midY`, `isEmpty`, `contains(point)`, `insetBy({dx, dy})`, `offsetBy({dx, dy})`, and `CGRect.zero`; as on Apple's there is no `x` or `y`. `frame` is read-only on purpose: the stylesheet owns geometry here, and a setter would fight it.
- `UIView.transform` is a `CGAffineTransform` (`identity`, `{scaleX, y}`, `{translationX, y}`, `{rotationAngle}`, `scaledBy`, `translatedBy`, `rotated`, `concatenating`, `inverted`), written as the element's CSS transform; inside `UIView.animate` the element transitions to it.
- `CAGradientLayer`: `colors`, `locations`, `startPoint` and `endPoint` (`CGPoint`), drawn as a CSS linear-gradient in an element that fills the superlayer once `view.layer.addSublayer(layer)` adds it.
- `UIButton`: `showsActivityIndicator = true` swaps the title for a spinner and disables the button until set back; `icon = {position, icon, text}` places an icon beside the title.
- `UITextField`: the delegate gets `textFieldDidBeginEditing`, `textFieldDidEndEditing` and `textFieldShouldReturn`; `isFirstResponder`, `becomeFirstResponder()`, `resignFirstResponder()`.
- `UISearchTextField`: tokens with `insertToken`, `removeToken`, `removeAllTokens`, validation, paste handling, keyboard selection; the delegate gets `tokensUpdated`, `textFieldWillInsertText` and `textFieldDidPaste`. Selected tokens use the view's `tintColor`, which defaults to the page's `--action-or-selection-color` token.
- `UIDatePicker`: `date`, `minimumDate`, `maximumDate`, `locale`, `datePickerMode = "yearAndMonth"`; wraps the jQuery UI datepicker, so `jquery-ui` must be on the page where it is used.
- `UIDevice.current` (its `userInterfaceIdiom` is a `UIUserInterfaceIdiom`: `phone`, `pad` or `web` for a desktop browser): `model`, `platform`, `userInterfaceIdiom`.
- `UITapGestureRecognizer({target, action})` with `view.addGestureRecognizer(recognizer)`.
- Foundation: `DispatchGroup` (`enter`, `leave`, `notify`), `IndexPath({row, section})`, `Locale(identifier)` with date formats and datepicker regional strings.

Views get an `init()` hook that runs when the object is constructed, before any nib is attached. `UILabel.text` and friends sanitize through DOMPurify when the page loads it, and strip scripts otherwise.

`cocoatouch/uikit.css` carries the few styles the controls need; import it once.

## Video

`import "AVKit"` brings AVFoundation's player, as it does in Swift. An `AVPlayer` plays one `AVPlayerItem`, which wraps an `AVURLAsset`; it draws through an `AVPlayerLayer`, which on the web is a `<video>` element. An `AVPlayerViewController` outlet bound to a `<video>` plays there, and bound to any other element appends the `<video>` it plays in.

```js
@IBOutlet("#hero-video", AVPlayerViewController) heroVideo

viewDidLoad() {
    this.heroVideo.player = new AVPlayer({url: "/static/hero.mp4"})
    this.heroVideo.videoGravity = AVLayerVideoGravity.resizeAspectFill
    NotificationCenter.default.addObserver(this, {name: AVPlayerItem.didPlayToEndTimeNotification, object: this.heroVideo.player.currentItem, selector: "videoDidEnd"})
}
```

`play()`, `pause()`, `rate`, `isMuted`, `volume`, `currentTime()`, `seek({to, completionHandler})`, `status`, `error`, `timeControlStatus`, `actionAtItemEnd` and `replaceCurrentItem({with})` follow AVFoundation. Times are Core Media `CMTime` values, as in Swift: `player.currentTime().seconds` reads one, `player.seek({to: new CMTime({seconds: 10, preferredTimescale: 600})})` makes one, and an item's `duration` is `CMTime.indefinite` until the media reports it. `import "AVKit"` brings `CMTime` along, the way AVFoundation re-exports Core Media. The player writes only what the app sets, so a `<video muted autoplay loop>` keeps its own attributes. `AVPlayerLayer({player})` makes a layer with its own element for `view.layer.addSublayer(layer)`.

## Notifications

`NotificationCenter.default` is observer keyed. Pass a DOM event target as `object` to observe that event; leave it out to post and observe in-app notifications.

```js
NotificationCenter.default.addObserver(this, {name: "scroll", object: window, selector: () => this.updateMenu()})
NotificationCenter.default.addObserver(this, {name: "cartDidChange", selector: "cartDidChange"})
NotificationCenter.default.post({name: "cartDidChange", userInfo: {count: 3}})
NotificationCenter.default.removeObserver(this)
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

Capture the `<cocoatouch>` inner html after `present`, serve it with `window.__PRERENDERED = true`, and call `controller.restore(controller)` instead of `present`. Outlets and actions rebind to the existing DOM, and views added at runtime through `addSubview` are found again by their `@IBAction` selectors. `restore(_:)` is this framework's hydration entry point, not a UIKit interface; UIKit's vocabulary for it is state restoration, which is where this is headed.

One element has one owner. A registered view class is revived only for an action target no bound responder already answers with that same selector, so an outlet that declares `@IBAction("#logo")` is not shadowed by a page-wide ghost of its own class; a target inside an outlet container that declares no action on it, such as a message view added into `this.messagesView`, is still revived. When a class and its subclass both match the same target, only the most derived is revived. Two limitations remain. Sibling subclasses that declare the same action selectors cannot be told apart by this scan; the fix is `restorationIdentifier`, which is not here yet. And a revived view is constructed with no selector, so its class fields and `init()` run, but `init()` runs against an empty `$el`: work `init()` does on the element, such as `UISearchTextField` appending its input, does not land. A view that touches its element should do so in `awakeFromNib`, which `restore` does not send either; `didMoveToWindow` is the hook a restored view receives.

## Classes

| Foundation | UIKit | Other |
|---|---|---|
| NSObject | UIResponder, UIView, UIViewController | CALayer, CAGradientLayer, CMTime, CGPoint, CGSize, CGRect, CGAffineTransform |
| NotificationCenter | UIControl, UIButton, UILabel, UITextField, UISearchTextField | AVPlayer, AVPlayerViewController |
| | UIImageView, UIImage, UIColor, UIControlEvent | |
| | UIScrollView, UITableView, UITableViewCell | |
| | UIPickerView, UISegmentedControl, UISwitch | |
| | UIProgressView, UIActivityIndicatorView | |
| DispatchGroup, IndexPath, Locale | UIDevice, UIDatePicker, UICollectionView | AVPlayerItem, AVURLAsset, AVPlayerLayer |
| NSUserActivity, NSUserActivityTypeBrowsingWeb | IBOutlet, IBAction, IBInspectable, UIKeyCommand, UIKeyModifierFlags | |

## Sample

`sample/` is a small app with a menu of pages, one per part of UIKit: buttons, labels, text fields, a custom view with its own nib (also bound through a subclass), a table view with a custom cell, and, since 1.4.0, links through `userActivity`, `UIImage(systemName:)`, `UIScrollView` offsets and key commands next to a text field. It depends on this package through `file:..`, so it runs against the working tree, and loads Font Awesome for the symbol images.

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

Each test file picks its page. A file that only exercises lifecycle, responder chain or observer bookkeeping imports `./setup.js`, a chainable jQuery stand-in that remembers the html it was given. A file that binds outlets, resolves nib roots, dequeues table rows or dispatches DOM events imports `./dom.js`, which installs a jsdom document and the real jQuery and exports `page(html)` to start from a body of its own. Node runs each file in its own process, so the two never meet; a file imports one of them and never both. `npm test` also regenerates `types/` and `eslint/globals.cjs`, which are committed.
