import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIApplication, NotificationCenter } from "../src/index.js"


// Records window.open the way a browser receives it; noopener makes the real one return null.
function withWindowOpen(run) {
    var calls = []
    var original = window.open
    window.open = function(...args) { calls.push(args); return null }
    try { run(calls) } finally { window.open = original }
}

test("UIApplication.shared is one object for the page", function() {
    assert.ok(UIApplication.shared instanceof UIApplication)
    assert.equal(UIApplication.shared, UIApplication.shared)
})

test("open sends an http(s), mailto or tel address to a new tab with noopener and completes true", function() {
    withWindowOpen(function(calls) {
        var results = []
        for (var url of ["https://starkbank.com/docs", "http://localhost:8080/x", "mailto:help@starkbank.com", "tel:+551140000000"]) {
            UIApplication.shared.open(url, {completionHandler: (success) => results.push(success)})
        }
        assert.deepEqual(calls.map((call) => call[0]), ["https://starkbank.com/docs", "http://localhost:8080/x", "mailto:help@starkbank.com", "tel:+551140000000"])
        assert.ok(calls.every((call) => call[1] === "_blank" && call[2] === "noopener"))
        assert.deepEqual(results, [true, true, true, true])
    })
})

test("open takes a URL object and writes its string", function() {
    withWindowOpen(function(calls) {
        UIApplication.shared.open(new URL("https://starkbank.com/pix"))
        assert.deepEqual(calls, [["https://starkbank.com/pix", "_blank", "noopener"]])
    })
})

test("a scheme a browser would execute is refused: nothing opens and completion gets false", function() {
    withWindowOpen(function(calls) {
        var results = []
        for (var url of ["javascript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "file:///etc/passwd", "ftp://host/file", "blob:https://x/1"]) {
            UIApplication.shared.open(url, {completionHandler: (success) => results.push(success)})
        }
        assert.deepEqual(calls, [])
        assert.deepEqual(results, [false, false, false, false, false, false])
    })
})

test("open without a completionHandler or options does not throw, and options is accepted", function() {
    withWindowOpen(function(calls) {
        UIApplication.shared.open("javascript:1")
        UIApplication.shared.open("https://starkbank.com", {options: {}})
        assert.equal(calls.length, 1)
    })
})

test("canOpenURL is true for the accepted schemes and false for the rest, without opening anything", function() {
    withWindowOpen(function(calls) {
        var app = UIApplication.shared
        assert.equal(app.canOpenURL("https://starkbank.com"), true)
        assert.equal(app.canOpenURL(new URL("mailto:a@b.co")), true)
        assert.equal(app.canOpenURL("tel:+5511"), true)
        assert.equal(app.canOpenURL("javascript:alert(1)"), false)
        assert.equal(app.canOpenURL("file:///x"), false)
        assert.deepEqual(calls, [])
    })
})

test("a url that is neither a String nor a URL, and a completionHandler that is not a function, are refused with a TypeError", function() {
    var app = UIApplication.shared
    assert.throws(() => app.open(42), (error) => error instanceof TypeError && /UIApplication\.open/.test(error.message) && /url/.test(error.message))
    assert.throws(() => app.open(null), TypeError)
    assert.throws(() => app.canOpenURL({}), (error) => error instanceof TypeError && /UIApplication\.canOpenURL/.test(error.message))
    assert.throws(() => app.open("https://starkbank.com", {completionHandler: "done"}), (error) => error instanceof TypeError && /completionHandler/.test(error.message))
})

test("a relative address opens as the absolute one it was validated as, mailto and tel unchanged", function() {
    withWindowOpen(function(calls) {
        UIApplication.shared.open("/docs/pix")
        UIApplication.shared.open("mailto:help@starkbank.com")
        UIApplication.shared.open("tel:+551140000000")
        assert.deepEqual(calls.map((call) => call[0]), ["http://localhost/docs/pix", "mailto:help@starkbank.com", "tel:+551140000000"])
    })
})


// Page visibility. The state is read when UIApplication.shared is first made, so
// each case imports a fresh copy of the module, with document.visibilityState
// defined before the import; the stand-in document is one for the whole file, so
// a notification is observed by the object that posts it, never by name alone.
var generation = 0
var visibility = {value: "visible"}
var originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState")

function setVisibility(value) {
    visibility.value = value
    document.dispatchEvent(new window.Event("visibilitychange"))
}

async function freshApplication(initial) {
    visibility.value = initial
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => visibility.value})
    var module = await import("../src/uikit/uiapplication.js?fresh=" + (++generation))
    return module.UIApplication
}

function observing(application, name, onPost) {
    var observer = {}
    var posts = []
    NotificationCenter.default.addObserver(observer, {name, object: application.shared, selector: (notification) => {
        posts.push(notification)
        if (onPost) { onPost(notification) }
    }})
    posts.stop = () => NotificationCenter.default.removeObserver(observer)
    return posts
}

test.afterEach(function() {
    if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility)
        return
    }
    delete document.visibilityState
})

test("UIApplication.State has Apple's three cases, frozen, and applicationState has no setter", async function() {
    var Application = await freshApplication("visible")
    assert.deepEqual({...Application.State}, {active: 0, inactive: 1, background: 2})
    assert.ok(Object.isFrozen(Application.State))
    assert.equal(Application.State, Application.State)
    var descriptor = Object.getOwnPropertyDescriptor(Application.prototype, "applicationState")
    assert.equal(typeof descriptor.get, "function")
    assert.equal(descriptor.set, undefined)
    var app = Application.shared
    var thrown = false
    try { app.applicationState = Application.State.background } catch (error) { thrown = true }
    assert.equal(thrown, true, "a module is strict: writing a getter-only property throws")
    assert.equal(app.applicationState, Application.State.active)
})

test("a visible page starts active, a hidden one starts in the background", async function() {
    var visible = await freshApplication("visible")
    assert.equal(visible.shared.applicationState, visible.State.active)
    var hidden = await freshApplication("hidden")
    assert.equal(hidden.shared.applicationState, hidden.State.background)
    var prerender = await freshApplication("prerender")
    assert.equal(prerender.shared.applicationState, prerender.State.active)
})

test("the notification names are Apple's raw strings", async function() {
    var Application = await freshApplication("visible")
    assert.equal(Application.didEnterBackgroundNotification, "UIApplicationDidEnterBackgroundNotification")
    assert.equal(Application.willEnterForegroundNotification, "UIApplicationWillEnterForegroundNotification")
    assert.equal(Application.didBecomeActiveNotification, "UIApplicationDidBecomeActiveNotification")
})

test("showing the page posts didBecomeActive after willEnterForeground, with the application already active", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    setVisibility("hidden")
    var order = []
    var foreground = observing(Application, Application.willEnterForegroundNotification, () => order.push(["willEnterForeground", app.applicationState]))
    var active = observing(Application, Application.didBecomeActiveNotification, () => order.push(["didBecomeActive", app.applicationState]))
    setVisibility("visible")
    setVisibility("visible")
    assert.deepEqual(order, [["willEnterForeground", Application.State.inactive], ["didBecomeActive", Application.State.active]])
    assert.equal(active[0].object, app)
    assert.equal(active[0].userInfo, null)
    foreground.stop()
    active.stop()
})

test("hiding the page posts didEnterBackground once, from the shared application, which is already in the background", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    var states = []
    var posts = observing(Application, Application.didEnterBackgroundNotification, () => states.push(app.applicationState))
    setVisibility("hidden")
    assert.equal(posts.length, 1)
    assert.equal(posts[0].object, app)
    assert.equal(posts[0].userInfo, null)
    assert.equal(posts[0].name, "UIApplicationDidEnterBackgroundNotification")
    assert.deepEqual(states, [Application.State.background])
    assert.equal(app.applicationState, Application.State.background)
    posts.stop()
})

test("showing the page posts willEnterForeground once, with the application inactive inside it and active after", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    setVisibility("hidden")
    var states = []
    var posts = observing(Application, Application.willEnterForegroundNotification, () => states.push(app.applicationState))
    setVisibility("visible")
    assert.equal(posts.length, 1)
    assert.equal(posts[0].object, app)
    assert.deepEqual(states, [Application.State.inactive])
    assert.equal(app.applicationState, Application.State.active)
    posts.stop()
})

test("a page that loaded hidden posts willEnterForeground when it is first shown", async function() {
    var Application = await freshApplication("hidden")
    var posts = observing(Application, Application.willEnterForegroundNotification)
    setVisibility("visible")
    assert.equal(posts.length, 1)
    assert.equal(Application.shared.applicationState, Application.State.active)
    posts.stop()
})

test("a repeated event with the same visibility posts nothing", async function() {
    var Application = await freshApplication("visible")
    var entered = observing(Application, Application.didEnterBackgroundNotification)
    var returned = observing(Application, Application.willEnterForegroundNotification)
    setVisibility("visible")
    assert.equal(entered.length + returned.length, 0, "a visible event while active")
    setVisibility("hidden")
    setVisibility("hidden")
    assert.equal(entered.length, 1)
    setVisibility("visible")
    setVisibility("visible")
    assert.equal(returned.length, 1)
    assert.equal(entered.length, 1)
    entered.stop()
    returned.stop()
})

test("reading shared again and again installs one listener: one event posts one notification", async function() {
    var Application = await freshApplication("visible")
    Application.shared
    Application.shared
    Application.shared
    var posts = observing(Application, Application.didEnterBackgroundNotification)
    setVisibility("hidden")
    assert.equal(posts.length, 1)
    posts.stop()
})

test("the state follows a full hide and show cycle more than once", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    var names = []
    var observer = {}
    for (var name of [Application.didEnterBackgroundNotification, Application.willEnterForegroundNotification, Application.didBecomeActiveNotification]) {
        NotificationCenter.default.addObserver(observer, {name, object: app, selector: (notification) => names.push(notification.name.replace("UIApplication", "").replace("Notification", ""))})
    }
    for (var round = 0; round < 3; round++) {
        setVisibility("hidden")
        setVisibility("visible")
    }
    NotificationCenter.default.removeObserver(observer)
    assert.deepEqual(names, ["DidEnterBackground", "WillEnterForeground", "DidBecomeActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive"])
    assert.equal(app.applicationState, Application.State.active)
})
