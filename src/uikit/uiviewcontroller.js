import { UIResponder } from "./uiresponder.js"
import { Build } from "../utils/build.js"
import { Bind } from "../utils/bind.js"
import { UIView } from "./uiview.js"
import { CGSize } from "../coregraphics/cgsize.js"
import { traitCollectionForSize, sameTraits, currentTraitCollection, setCurrentTraitCollection } from "./uitraitcollection.js"


export class UIViewController extends UIResponder {

    viewDidLoad() {

    }

    viewWillAppear() {

    }

    viewDidAppear() {

    }

    viewWillDisappear() {

    }

    viewDidDisappear() {

    }

    // Runs when the window changes size, before the page lays out for it; the
    // coordinator runs work alongside the change and after it, as UIKit's does.
    viewWillTransition({to: size, with: coordinator}) {

    }

    // UIContentContainer: the size classes are about to change, before they do.
    willTransition({to: newCollection, with: coordinator}) {

    }

    // UITraitEnvironment: the page's traits, and the hook sent after they change.
    get traitCollection() {
        return currentTraitCollection()
    }

    traitCollectionDidChange(previousTraitCollection) {

    }

    present(viewController, {animated, completion} = {}) {
        _dismissRootViewController()
        var nib = Build.html(viewController)
        var body = $("cocoatouch")
        var display = body.css("display")

        _adoptHost(viewController, body)
        body.css("display", "none")
        // Root from this moment, not from the ready tick: a present() issued in
        // between then dismisses this controller instead of letting it load
        // afterwards and keep its observers with nothing left to release them.
        _rootViewController = viewController
        body.html(nib).ready(() => {
            if (_rootViewController !== viewController) { return }
            viewController._$el = body
            Bind.ibOutlet(viewController)
            Bind.ibAction(viewController)
            body.css("display", display)
            viewController._isViewLoaded = true
            viewController.viewDidLoad()
            viewController.viewWillAppear()
            viewController.viewDidAppear()
            if (completion) { completion() }
        })
    }

    restore(viewController) {
        _dismissRootViewController()
        var body = $("cocoatouch")
        _adoptHost(viewController, body)
        viewController._$el = body
        Bind.ibOutletRestore(viewController)
        Bind.ibAction(viewController)
        Bind.restoreRegisteredViews(body, viewController)
        _rootViewController = viewController
        viewController._isViewLoaded = true
        viewController.viewWillAppear()
        viewController.viewDidAppear()
    }

    get isViewLoaded() {
        return this._isViewLoaded === true
    }

    get view() {
        if (this._view) { return this._view }
        this._view = new UIView(this.selector)
        this._view.nib = this.constructor.nib
        this._view.next = this
        return this._view
    }

    // Child view controllers, as in UIKit's containment API: a parent adds a
    // child, then puts the child's view in one of its container views.
    get children() {
        if (!this._children) { this._children = [] }
        return this._children
    }

    get parent() {
        return this._parent || null
    }

    addChild(child) {
        if (child._parent === this) { return }
        if (child._parent) { child.removeFromParent() }
        child.willMove({toParent: this})
        child._parent = this
        child.next = this
        this.children.push(child)
    }

    removeFromParent() {
        var parent = this._parent
        if (!parent) { return }
        this.willMove({toParent: null})
        if (this._isEmbedded) { this.view.removeFromSuperview() }
        var index = parent.children.indexOf(this)
        if (index !== -1) { parent.children.splice(index, 1) }
        this._parent = null
        this.next = null
        this.didMove({toParent: null})
    }

    willMove({toParent}) {

    }

    didMove({toParent}) {

    }

    // The container view hands its element to the child, like present() hands
    // <cocoatouch> to the root controller: the child's nib fills the container
    // and its outlets and actions are bound inside it.
    _embed(containerView) {
        var body = containerView.$el
        var id = body.attr("id")
        if (id) {
            this.selector = "#" + id
            this._identifier = id
        }
        if (!id) { this.selector = containerView.selector }
        this._view = null
        this._$el = body
        this.view._$el = body
        this.view._container = containerView
        body.html(Build.html(this))
        Bind.ibOutlet(this)
        Bind.ibAction(this)
        this._isEmbedded = true
        this.viewDidLoad()
        this.viewWillAppear()
        this.viewDidAppear()
        if (this._parent) { this.didMove({toParent: this._parent}) }
    }

    _unembed() {
        if (!this._isEmbedded) { return }
        this._isEmbedded = false
        var controllers = _controllersUnder(this)
        for (var controller of controllers) { controller.viewWillDisappear() }
        this._$el.empty()
        this._dispose()
        _clearContainment(this)
        for (var disposed of controllers) { disposed.viewDidDisappear() }
    }

    _link(view) {
        this.view._link(view)
    }

    _dispose() {
        for (var child of this.children.slice()) {
            child._dispose()
        }
        this.view._dispose()
        super._dispose()
    }
}


// The page hosts one root controller at a time. Presenting a new one dismisses
// it first, so nothing it observes on window or document survives the swap.
var _rootViewController = null

// A window resize is a size transition for the root controller and its
// children, and then a layout pass over their view trees, outlets included.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    var _resizeScheduled = false
    window.addEventListener("resize", function() {
        if (_resizeScheduled) { return }
        _resizeScheduled = true
        var schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : function(run) { run() }
        schedule(function() {
            _resizeScheduled = false
            _resize(_windowSize())
        })
    })
}

function _windowSize() {
    return new CGSize({width: window.innerWidth || 0, height: window.innerHeight || 0})
}

var _coordinator = {
    animate({alongsideTransition, completion}) {
        if (alongsideTransition) { alongsideTransition() }
        if (completion) { completion() }
    }
}

// Apple's order on a size change: willTransition(to:with:) while the old
// traits still read, then viewWillTransition(to:with:), then, once the new
// traits read, traitCollectionDidChange(_:) and layoutSubviews(). The trait
// hooks go out only when the size classes actually changed.
function _resize(size) {
    var previous = currentTraitCollection()
    var next = traitCollectionForSize(size)
    var change = sameTraits(previous, next) ? null : previous
    var root = _rootViewController
    if (root && change) { _eachController(root, function(viewController) { viewController.willTransition({to: next, with: _coordinator}) }) }
    setCurrentTraitCollection(next)
    if (root) { _transition(root, size, change) }
}

function _transition(viewController, size, change) {
    viewController.viewWillTransition({to: size, with: _coordinator})
    for (var child of viewController.children) {
        _transition(child, size, change)
    }
    if (change) {
        viewController.traitCollectionDidChange(change)
        _traitTree(viewController.view, change)
    }
    _layoutTree(viewController.view, size, change)
}

// A controller bound as an outlet is a child in all but name, so it gets the
// transition too; its own trait hooks go out inside that transition.
function _eachController(viewController, visit) {
    visit(viewController)
    for (var child of viewController.children) {
        _eachController(child, visit)
    }
    _eachEmbedded(viewController.view, visit)
}

function _eachEmbedded(view, visit) {
    for (var subview of view.subviews || []) {
        if (subview instanceof UIViewController) { _eachController(subview, visit); continue }
        _eachEmbedded(subview, visit)
    }
}

function _traitTree(view, change) {
    if (view instanceof UIViewController) { return }
    if (typeof view.traitCollectionDidChange === "function") { view.traitCollectionDidChange(change) }
    for (var subview of view.subviews || []) {
        _traitTree(subview, change)
    }
}

function _layoutTree(view, size, change) {
    if (view instanceof UIViewController) {
        _transition(view, size, change)
        return
    }
    if (typeof view.layoutSubviews === "function") { view.layoutSubviews() }
    for (var subview of view.subviews || []) {
        _layoutTree(subview, size, change)
    }
}

function _dismissRootViewController() {
    var viewController = _rootViewController
    if (!viewController) { return }
    _rootViewController = null
    // A controller superseded before its ready tick never appeared, so only
    // what it registered so far is released; the appearance hooks stay unpaired.
    if (!viewController.isViewLoaded) {
        viewController._dispose()
        return
    }
    var controllers = _controllersUnder(viewController)
    for (var controller of controllers) { controller.viewWillDisappear() }
    viewController._dispose()
    _clearContainment(viewController)
    for (var disposed of controllers) { disposed.viewDidDisappear() }
}

// A container forwards the appearance pair to its children and to the
// controllers bound as its outlets, itself first, as UIKit's automatic
// forwarding does. The tree is collected before disposal empties it.
function _controllersUnder(viewController) {
    var controllers = []
    _eachController(viewController, function(controller) { controllers.push(controller) })
    return controllers
}

// A disposed child is no longer anyone's child, as after removeFromParent.
function _clearContainment(viewController) {
    for (var child of viewController.children) {
        _clearContainment(child)
        child._parent = null
        child.next = null
    }
    viewController._children = []
}


// The controller takes over the host element. A host that already has an id
// keeps it, so stylesheets and code addressing that id keep working; a bare
// <cocoatouch> gets the controller's own id.
function _adoptHost(viewController, body) {
    var id = body.attr("id")
    if (id) {
        viewController.selector = "#" + id
        viewController._identifier = id
        return
    }
    body.prop("id", viewController.identifier)
}
