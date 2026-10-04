import { UIViewController } from "./uiviewcontroller.js"
import { UIView } from "./uiview.js"
import { UINavigationBar } from "./uinavigationbar.js"
import { IBOutlet } from "./iboutlet.js"
import { UIControlEvent } from "./uicontrolevent.js"
import { UIControlState } from "./uicontrolstate.js"
import { NotificationCenter } from "../foundation/notificationcenter.js"
import { required } from "../utils/required.js"


// UINavigationController: a stack of controllers, one host view per entry,
// bound to browser history. A navigation stack and the session history are
// the same data structure: push stamps a history entry with the stack depth,
// pop goes back one, and the browser's back button pops. The stack cannot
// know what a forward entry held, so popstate only ever pops.
export class UINavigationController extends UIViewController {

    constructor({rootViewController} = {}) {
        super()
        this._isNavigationStack = true
        this._entries = []
        this._delegate = null
        this._isNavigationBarHidden = false
        if (rootViewController) { this._entries.push(_entry(rootViewController)) }
    }

    get viewControllers() {
        return this._entries.map((entry) => entry.viewController)
    }

    set viewControllers(viewControllers) {
        this.setViewControllers(viewControllers, {animated: false})
    }

    get topViewController() {
        var top = this._top()
        return top ? top.viewController : null
    }

    get visibleViewController() {
        return this.topViewController
    }

    get delegate() {
        return this._delegate
    }

    set delegate(delegate) {
        this._delegate = delegate
    }

    get isNavigationBarHidden() {
        return this._isNavigationBarHidden
    }

    set isNavigationBarHidden(hidden) {
        this.setNavigationBarHidden(hidden, {animated: false})
    }

    setNavigationBarHidden(hidden, {animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.setNavigationBarHidden", "setNavigationBarHidden(hidden, {animated: false}). Apple's is setNavigationBarHidden(_:animated:)")
        this._isNavigationBarHidden = hidden
        if (this.isViewLoaded) { this.navigationBar.isHidden = hidden }
    }

    pushViewController(viewController, {animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.pushViewController", "pushViewController(viewController, {animated: true}). Apple's is pushViewController(_:animated:)")
        var outgoing = this._top()
        var entry = _entry(viewController)
        this._entries.push(entry)
        if (!this.isViewLoaded) { return }
        this._hide(outgoing, animated)
        _pushHistory(this._entries.length - 1, viewController)
        this._show(entry, animated)
    }

    // Apple refuses to pop the root; a stack that could be emptied would leave the page blank.
    popViewController({animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.popViewController", "popViewController({animated: true}). Apple's is popViewController(animated:)")
        if (this._entries.length < 2) { return null }
        var popped = this._popTo(this._entries.length - 2, animated)
        this._goBack(popped.length)
        return popped[0]
    }

    popToRootViewController({animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.popToRootViewController", "popToRootViewController({animated: true}). Apple's is popToRootViewController(animated:)")
        if (this._entries.length < 2) { return [] }
        var popped = this._popTo(0, animated)
        this._goBack(popped.length)
        return popped
    }

    popToViewController(viewController, {animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.popToViewController", "popToViewController(viewController, {animated: true}). Apple's is popToViewController(_:animated:)")
        var index = this.viewControllers.indexOf(viewController)
        if (index === -1) { return null }
        if (index === this._entries.length - 1) { return [] }
        var popped = this._popTo(index, animated)
        this._goBack(popped.length)
        return popped
    }

    // Tears every host down and builds fresh ones for the new stack; the new
    // top appears, the others load when they are popped back to.
    setViewControllers(viewControllers, {animated} = {}) {
        required({animated: animated}, "animated", "UINavigationController.setViewControllers", "setViewControllers(viewControllers, {animated: false}). Apple's is setViewControllers(_:animated:)")
        if (this.isViewLoaded) {
            for (var entry of this._entries.slice().reverse()) { this._remove(entry, animated) }
        }
        this._entries = viewControllers.map(_entry)
        if (!this.isViewLoaded) { return }
        _replaceDepth(this._entries.length - 1)
        var top = this._top()
        if (top) { this._show(top, animated) }
    }

    // The framework's own load step, kept out of viewDidLoad so a subclass can
    // override that hook without having to call super.
    _viewDidLoad() {
        this.navigationBar.backButton.addTarget(this, {action: (nav) => nav.popViewController({animated: true}), for: UIControlEvent.touchUpInside})
        this.navigationBar.isHidden = this._isNavigationBarHidden
        _replaceDepth(this._entries.length - 1)
        NotificationCenter.default.addObserver(this, {name: "popstate", object: window, selector: (event) => this._historyDidPop(event)})
        var top = this._top()
        if (top) { this._show(top, false) }
    }

    _top() {
        return this._entries[this._entries.length - 1] || null
    }

    _hide(entry, animated) {
        if (!entry || !entry.hostView) { return }
        entry.viewController._sendWillDisappear(animated)
        entry.viewController._sendDidDisappear(animated)
        entry.hostView.isHidden = true
    }

    // Loads the entry into a host of its own the first time, then appears it;
    // the delegate's willShow lands after viewDidLoad, as Apple's does.
    _show(entry, animated) {
        var viewController = entry.viewController
        if (!entry.hostView) {
            entry.hostView = new UIView()
            this.contentView.addSubview(entry.hostView)
            this.addChild(viewController)
            viewController._load(entry.hostView)
        }
        entry.hostView.isHidden = false
        this.contentView.$el.toggleClass("animated", animated)
        this._delegateCall("navigationControllerWillShowViewControllerAnimated", viewController, animated)
        viewController._appearEmbedded({animated: animated})
        if (!entry.didMove) {
            entry.didMove = true
            viewController.didMove({toParent: this})
        }
        this._updateBar()
        this._delegateCall("navigationControllerDidShowViewControllerAnimated", viewController, animated)
    }

    _remove(entry, animated) {
        var viewController = entry.viewController
        if (entry.hostView) {
            viewController._unembed({animated: animated})
            viewController.removeFromParent()
            entry.hostView.removeFromSuperview()
            return
        }
        var index = this._entries.indexOf(entry)
        if (index !== -1) { this._entries.splice(index, 1) }
    }

    // Pops down to the entry at `index`, deepest first, and returns the popped
    // controllers in stack order. The stack mutates synchronously.
    _popTo(index, animated) {
        var popped = this._entries.splice(index + 1)
        for (var entry of popped.slice().reverse()) { this._remove(entry, animated) }
        this._show(this._top(), animated)
        return popped.map((entry) => entry.viewController)
    }

    // The resulting popstate carries the depth the stack already has, so the
    // handler finds nothing to pop; the expectation makes that explicit.
    _goBack(levels) {
        this._expectedDepth = this._entries.length - 1
        window.history.go(-levels)
    }

    // The depth is history state any same-origin script can write, so a
    // non-integer is ignored rather than coerced into a splice index.
    _historyDidPop(event) {
        var depth = Number(event.state && event.state.cocoatouchNavDepth)
        if (!event.state || event.state.cocoatouchNavDepth === null || event.state.cocoatouchNavDepth === undefined || !Number.isInteger(depth)) { return }
        if (this._expectedDepth === depth) {
            this._expectedDepth = null
            return
        }
        this._expectedDepth = null
        if (depth >= this._entries.length - 1 || depth < 0) { return }
        this._popTo(depth, false)
    }

    _updateBar() {
        var bar = this.navigationBar
        var top = this._top()
        var previous = this._entries[this._entries.length - 2]
        if (!bar || !top) { return }
        bar.titleLabel.text = top.viewController.navigationItem.title || ""
        bar.backButton.isHidden = !previous || top.viewController.navigationItem.hidesBackButton === true
        if (previous) { bar.backButton.setTitle(previous.viewController.navigationItem.title || "Back", {for: UIControlState.normal}) }
    }

    _delegateCall(method) {
        var delegate = this._delegate
        if (!delegate || typeof delegate[method] !== "function") { return }
        var args = Array.prototype.slice.call(arguments, 1)
        delegate[method].apply(delegate, [this].concat(args))
    }
}

UINavigationController.nib = "<div id=\"navigation-bar\"></div><div id=\"navigation-content\"></div>"
IBOutlet("#navigation-bar", UINavigationBar)(UINavigationController.prototype, "navigationBar", {})
IBOutlet("#navigation-content", UIView)(UINavigationController.prototype, "contentView", {})


function _entry(viewController) {
    return {viewController: viewController, hostView: null, didMove: false}
}

// A controller's address is its browsing activity; one without keeps the url.
function _pushHistory(depth, viewController) {
    if (typeof window === "undefined" || !window.history) { return }
    var activity = viewController.userActivity
    var url = activity && activity.webpageURL
    window.history.pushState({cocoatouchNavDepth: depth}, "", url === null || url === undefined ? null : String(url))
}

function _replaceDepth(depth) {
    if (typeof window === "undefined" || !window.history) { return }
    var state = Object.assign({}, window.history.state || {}, {cocoatouchNavDepth: depth})
    window.history.replaceState(state, "")
}
