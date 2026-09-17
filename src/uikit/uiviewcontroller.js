import { UIResponder } from "./uiresponder.js"
import { Build } from "../utils/build.js"
import { Bind } from "../utils/bind.js"
import { UIView } from "./uiview.js"


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

    present(viewController, {animated, completion} = {}) {
        _dismissRootViewController()
        var nib = Build.html(viewController)
        var body = $("cocoatouch")
        var display = body.css("display")

        _adoptHost(viewController, body)
        body.css("display", "none")
        body.html(nib).ready(() => {
            viewController._$el = body
            Bind.ibOutlet(viewController)
            Bind.ibAction(viewController)
            body.css("display", display)
            _rootViewController = viewController
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
        viewController.viewWillAppear()
        viewController.viewDidAppear()
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
        this.viewWillDisappear()
        this._$el.empty()
        this._dispose()
        this.viewDidDisappear()
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

function _dismissRootViewController() {
    var viewController = _rootViewController
    if (!viewController) { return }
    _rootViewController = null
    viewController.viewWillDisappear()
    viewController._dispose()
    viewController.viewDidDisappear()
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
