import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIViewController, UINavigationController, UINavigationBar, UINavigationItem, NSUserActivity, NSUserActivityTypeBrowsingWeb } from "../src/index.js"


function present(controller) {
    return new Promise((resolve) => controller.present(controller, {completion: resolve}))
}

function tick() {
    return new Promise((resolve) => setTimeout(resolve, 20))
}

function recording(name, log) {
    class Controller extends UIViewController {}
    ;["viewDidLoad", "viewWillLayoutSubviews", "viewDidLayoutSubviews"].forEach((hook) => { Controller.prototype[hook] = function() { log.push(name + "." + hook) } })
    ;["viewWillAppear", "viewDidAppear", "viewWillDisappear", "viewDidDisappear"].forEach((hook) => { Controller.prototype[hook] = function(animated) { log.push(name + "." + hook + "(" + animated + ")") } })
    Controller.prototype.willMove = function({toParent}) { log.push(name + ".willMove(" + (toParent ? "nav" : "null") + ")") }
    Controller.prototype.didMove = function({toParent}) { log.push(name + ".didMove(" + (toParent ? "nav" : "null") + ")") }
    Controller.nib = "<p class=\"" + name + "-page\">" + name + "</p>"
    var controller = new Controller()
    controller.navigationItem.title = name.toUpperCase()
    return controller
}

function delegateRecording(log) {
    return {
        navigationControllerWillShowViewControllerAnimated(nav, viewController, animated) { log.push("willShow(" + viewController.navigationItem.title + "," + animated + ")") },
        navigationControllerDidShowViewControllerAnimated(nav, viewController, animated) { log.push("didShow(" + viewController.navigationItem.title + "," + animated + ")") },
    }
}

async function stackOf(log, names) {
    page("<cocoatouch></cocoatouch>")
    window.history.replaceState(null, "", "/")
    var controllers = names.map((name) => recording(name, log))
    var nav = new UINavigationController({rootViewController: controllers[0]})
    nav.delegate = delegateRecording(log)
    await present(nav)
    for (var controller of controllers.slice(1)) { nav.pushViewController(controller, {animated: false}) }
    return {nav, controllers}
}

test("rootViewController: makes a one-deep stack with top and visible controller set", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a"])
    assert.deepEqual(nav.viewControllers, [controllers[0]])
    assert.equal(nav.topViewController, controllers[0])
    assert.equal(nav.visibleViewController, controllers[0])
    assert.equal(controllers[0].navigationController, nav)
    assert.equal(controllers[0].parent, nav)
    assert.ok(nav.navigationBar instanceof UINavigationBar)
    assert.ok(controllers[0].navigationItem instanceof UINavigationItem)
    assert.equal($("cocoatouch .a-page").length, 1)
})

test("push sends the disappear pair to the outgoing controller, loads the new one, then willShow, appear, didMove, didShow", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a"])
    var b = recording("b", log)
    log.length = 0
    nav.pushViewController(b, {animated: true})
    assert.deepEqual(log, [
        "a.viewWillDisappear(true)", "a.viewDidDisappear(true)",
        "b.willMove(nav)",
        "b.viewDidLoad",
        "willShow(B,true)",
        "b.viewWillAppear(true)", "b.viewWillLayoutSubviews", "b.viewDidLayoutSubviews", "b.viewDidAppear(true)",
        "b.didMove(nav)",
        "didShow(B,true)",
    ])
    assert.equal(nav.topViewController, b)
    assert.deepEqual(nav.viewControllers, [controllers[0], b])
})

test("pop sends the disappear pair and containment hooks to the popped controller, then reappears the one below without a second viewDidLoad", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b"])
    log.length = 0
    nav.popViewController({animated: true})
    assert.deepEqual(log, [
        "b.viewWillDisappear(true)", "b.viewDidDisappear(true)",
        "b.willMove(null)", "b.didMove(null)",
        "willShow(A,true)",
        "a.viewWillAppear(true)", "a.viewWillLayoutSubviews", "a.viewDidLayoutSubviews", "a.viewDidAppear(true)",
        "didShow(A,true)",
    ])
    assert.equal(nav.topViewController, controllers[0])
})

test("popViewController returns the popped controller synchronously", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b"])
    var popped = nav.popViewController({animated: false})
    assert.equal(popped, controllers[1])
    assert.deepEqual(nav.viewControllers, [controllers[0]])
})

test("popToRootViewController and popToViewController return the popped controllers and send one pair per popped controller", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b", "c", "d"])
    log.length = 0
    var popped = nav.popToViewController(controllers[1], {animated: false})
    assert.deepEqual(popped, [controllers[2], controllers[3]])
    assert.deepEqual(log.filter((entry) => /Disappear/.test(entry)), ["d.viewWillDisappear(false)", "d.viewDidDisappear(false)", "c.viewWillDisappear(false)", "c.viewDidDisappear(false)"])
    assert.deepEqual(log.filter((entry) => /Appear/.test(entry)), ["b.viewWillAppear(false)", "b.viewDidAppear(false)"])
    assert.equal(nav.topViewController, controllers[1])
    var e = recording("e", log)
    nav.pushViewController(e, {animated: false})
    log.length = 0
    var toRoot = nav.popToRootViewController({animated: false})
    assert.deepEqual(toRoot, [controllers[1], e])
    assert.deepEqual(log.filter((entry) => /Appear/.test(entry)), ["a.viewWillAppear(false)", "a.viewDidAppear(false)"])
    assert.equal(nav.popToViewController(new UIViewController(), {animated: false}), null)
})

test("setViewControllers replaces the stack and sends one appear pair, to the new top", async function() {
    var log = []
    var {nav} = await stackOf(log, ["a", "b"])
    var x = recording("x", log), y = recording("y", log)
    log.length = 0
    nav.setViewControllers([x, y], {animated: false})
    assert.deepEqual(nav.viewControllers, [x, y])
    assert.deepEqual(log.filter((entry) => /Appear\(/.test(entry)), ["y.viewWillAppear(false)", "y.viewDidAppear(false)"])
    assert.equal($("cocoatouch .y-page").length, 1)
    assert.equal($("cocoatouch .a-page").length, 0)
    assert.equal(nav.viewControllers.length, 2)
    nav.viewControllers = [x]
    assert.deepEqual(nav.viewControllers, [x])
})

test("push stamps the history depth, and a popstate pops exactly one level", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b", "c"])
    assert.equal(window.history.state.cocoatouchNavDepth, 2)
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: 1}}))
    assert.deepEqual(nav.viewControllers, [controllers[0], controllers[1]])
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: 5}}))
    assert.deepEqual(nav.viewControllers, [controllers[0], controllers[1]])
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: null}))
    assert.deepEqual(nav.viewControllers, [controllers[0], controllers[1]])
})

test("popViewController followed by its own popstate pops once, not twice", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b", "c"])
    nav.popViewController({animated: false})
    assert.deepEqual(nav.viewControllers, [controllers[0], controllers[1]])
    await tick()
    assert.deepEqual(nav.viewControllers, [controllers[0], controllers[1]])
    assert.equal(window.history.state.cocoatouchNavDepth, 1)
})

test("a pushed controller with a webpageURL changes the address and one without does not", async function() {
    var log = []
    var {nav} = await stackOf(log, ["a"])
    var b = recording("b", log)
    var activity = new NSUserActivity({activityType: NSUserActivityTypeBrowsingWeb})
    activity.webpageURL = "/detail"
    b.userActivity = activity
    nav.pushViewController(b, {animated: false})
    assert.equal(window.location.pathname, "/detail")
    var c = recording("c", log)
    nav.pushViewController(c, {animated: false})
    assert.equal(window.location.pathname, "/detail")
    assert.equal(window.history.state.cocoatouchNavDepth, 2)
})

test("the delegate's will and did pair fires in order with the animated flag", async function() {
    var log = []
    var {nav} = await stackOf(log, ["a"])
    var b = recording("b", log)
    log.length = 0
    nav.pushViewController(b, {animated: true})
    var delegateEntries = log.filter((entry) => /Show/.test(entry))
    assert.deepEqual(delegateEntries, ["willShow(B,true)", "didShow(B,true)"])
    assert.ok(log.indexOf("willShow(B,true)") < log.indexOf("b.viewWillAppear(true)"))
    assert.ok(log.indexOf("didShow(B,true)") > log.indexOf("b.didMove(nav)"))
})

test("the bar hides and shows, titles the top controller, and hidesBackButton suppresses the back button", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b"])
    var bar = nav.navigationBar
    assert.equal(bar.isHidden, false)
    assert.equal(bar.titleLabel.text, "B")
    assert.equal(bar.backButton.isHidden, false)
    assert.equal(bar.backButton.currentTitle, "A")
    bar.backButton.sendActions({for: "touchUpInside"})
    assert.equal(nav.topViewController, controllers[0])
    assert.equal(bar.backButton.isHidden, true)
    var c = recording("c", log)
    c.navigationItem.hidesBackButton = true
    nav.pushViewController(c, {animated: false})
    assert.equal(bar.backButton.isHidden, true)
    nav.setNavigationBarHidden(true, {animated: false})
    assert.equal(nav.isNavigationBarHidden, true)
    assert.equal(bar.isHidden, true)
    nav.isNavigationBarHidden = false
    assert.equal(bar.isHidden, false)
    assert.throws(() => nav.setNavigationBarHidden(true), TypeError)
    assert.throws(() => nav.pushViewController(recording("d", log)), TypeError)
    assert.throws(() => nav.popViewController(), TypeError)
})

test("navigationController is null for a controller outside a stack", function() {
    assert.equal(new UIViewController().navigationController, null)
    var nav = new UINavigationController()
    assert.equal(nav.navigationController, null)
    assert.deepEqual(nav.viewControllers, [])
    assert.equal(nav.topViewController, null)
})

test("each stack entry keeps its own host: the lower host stays in the document hidden, and the root's viewDidLoad runs once across a push and pop", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a"])
    var aHost = $("cocoatouch .a-page").parent()[0]
    var b = recording("b", log)
    nav.pushViewController(b, {animated: false})
    assert.equal(aHost.isConnected, true)
    assert.equal(getComputedStyle(aHost).display, "none")
    var bHost = $("cocoatouch .b-page").parent()[0]
    assert.notEqual(aHost, bHost)
    nav.popViewController({animated: false})
    assert.equal(bHost.isConnected, false)
    assert.equal(aHost.isConnected, true)
    assert.notEqual(getComputedStyle(aHost).display, "none")
    assert.equal(log.filter((entry) => entry === "a.viewDidLoad").length, 1)
    assert.equal($("cocoatouch .a-page").length, 1)
})

test("popViewController on a one-deep stack returns null and pops nothing", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a"])
    log.length = 0
    assert.equal(nav.popViewController({animated: false}), null)
    assert.deepEqual(nav.viewControllers, [controllers[0]])
    assert.deepEqual(log, [])
    assert.deepEqual(nav.popToRootViewController({animated: false}), [])
})

test("_embed keeps its order for existing callers after the load/appear split", async function() {
    var log = []
    page("<cocoatouch></cocoatouch>")
    class Host extends UIViewController {}
    Host.nib = "<div id=\"slot\"></div>"
    var host = new Host()
    await present(host)
    var child = recording("child", log)
    host.addChild(child)
    var slot = new UIView("#slot")
    slot.addSubview(child.view)
    assert.deepEqual(log, ["child.willMove(nav)", "child.viewDidLoad", "child.viewWillAppear(false)", "child.viewWillLayoutSubviews", "child.viewDidLayoutSubviews", "child.viewDidAppear(false)", "child.didMove(nav)"])
    assert.equal(child.isViewLoaded, true)
    log.length = 0
    child.removeFromParent()
    assert.deepEqual(log, ["child.willMove(null)", "child.viewWillDisappear(false)", "child.viewDidDisappear(false)", "child.didMove(null)"])
})

// Only a same-origin script can plant history state, but a depth must reach
// splice as an integer or not at all: a numeric string is read as its
// number, anything that is not an integer is ignored.
test("a popstate whose depth is not an integer is ignored, and an integer depth still pops", async function() {
    var log = []
    var {nav, controllers} = await stackOf(log, ["a", "b", "c", "d"])
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: 1.5}}))
    assert.deepEqual(nav.viewControllers, controllers)
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: {}}}))
    assert.deepEqual(nav.viewControllers, controllers)
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: "x"}}))
    assert.deepEqual(nav.viewControllers, controllers)
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: "2"}}))
    assert.deepEqual(nav.viewControllers, controllers.slice(0, 3))
    window.dispatchEvent(new window.PopStateEvent("popstate", {state: {cocoatouchNavDepth: 1}}))
    assert.deepEqual(nav.viewControllers, controllers.slice(0, 2))
})
