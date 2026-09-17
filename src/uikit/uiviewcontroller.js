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

        body.prop("id", viewController.identifier)
        body.css("display", "none")
        body.html(nib).ready(() => {
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
        body.prop("id", viewController.identifier)
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

    _link(view) {
        this.view._link(view)
    }

    _dispose() {
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
