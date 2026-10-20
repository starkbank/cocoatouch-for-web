import { page } from "./dom.js"
import { JSDOM } from "jsdom"
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


// Page visibility. The launch reads the state when UIKit loads, once per
// document, so each case builds a document of its own with visibilityState
// defined before a fresh copy of the module is evaluated on it. Notifications
// are observed by the application that posts them, never by name alone.
var generation = 0
var originalDocument = globalThis.document

function launchDocument(initial) {
    var dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {pretendToBeVisual: true, url: "http://localhost/"})
    var launched = dom.window.document
    var visibility = {value: initial}
    Object.defineProperty(launched, "visibilityState", {configurable: true, get: () => visibility.value})
    launched.setVisibility = function(value) {
        visibility.value = value
        launched.dispatchEvent(new dom.window.Event("visibilitychange"))
    }
    globalThis.document = launched
    return launched
}

async function evaluateEntry() {
    var module = await import("../src/uikit/uiapplication.js?fresh=" + (++generation))
    return module.UIApplication
}

async function freshApplication(initial) {
    launchDocument(initial)
    return evaluateEntry()
}

function setVisibility(value) {
    document.setVisibility(value)
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

// Every lifecycle notification of the application, in the order it is posted,
// each with the state the application reports inside it.
function recording(application) {
    var app = application.shared
    var observer = {}
    var log = []
    var names = [
        application.willResignActiveNotification,
        application.didEnterBackgroundNotification,
        application.willEnterForegroundNotification,
        application.didBecomeActiveNotification,
    ]
    for (var name of names) {
        NotificationCenter.default.addObserver(observer, {name, object: app, selector: (notification) => {
            log.push([notification.name.replace("UIApplication", "").replace("Notification", ""), app.applicationState])
        }})
    }
    log.stop = () => NotificationCenter.default.removeObserver(observer)
    return log
}

test.afterEach(function() {
    globalThis.document = originalDocument
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
    assert.equal(Application.willResignActiveNotification, "UIApplicationWillResignActiveNotification")
})

test("the application exists once the module has loaded: it is observed before shared is ever read", async function() {
    launchDocument("visible")
    var log = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: "UIApplicationDidEnterBackgroundNotification", selector: (notification) => log.push(notification.name)})
    var Application = await evaluateEntry()
    setVisibility("hidden")
    NotificationCenter.default.removeObserver(observer)
    assert.deepEqual(log, ["UIApplicationDidEnterBackgroundNotification"])
    assert.equal(Application.shared.applicationState, Application.State.background)
})

test("hiding the page posts willResignActive then didEnterBackground, each once, from the shared application", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    var states = []
    var resigned = observing(Application, Application.willResignActiveNotification, () => states.push(app.applicationState))
    var entered = observing(Application, Application.didEnterBackgroundNotification, () => states.push(app.applicationState))
    setVisibility("hidden")
    assert.equal(resigned.length, 1)
    assert.equal(entered.length, 1)
    assert.equal(entered[0].object, app)
    assert.equal(entered[0].userInfo, null)
    assert.equal(entered[0].name, "UIApplicationDidEnterBackgroundNotification")
    assert.deepEqual(states, [Application.State.inactive, Application.State.background])
    assert.equal(app.applicationState, Application.State.background)
    resigned.stop()
    entered.stop()
})

test("showing the page posts willEnterForeground then didBecomeActive, inactive inside the first and active inside the second", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    setVisibility("hidden")
    var states = []
    var foreground = observing(Application, Application.willEnterForegroundNotification, () => states.push(app.applicationState))
    var active = observing(Application, Application.didBecomeActiveNotification, () => states.push(app.applicationState))
    setVisibility("visible")
    assert.equal(foreground.length, 1)
    assert.equal(active.length, 1)
    assert.equal(foreground[0].object, app)
    assert.equal(active[0].object, app)
    assert.deepEqual(states, [Application.State.inactive, Application.State.active])
    assert.equal(app.applicationState, Application.State.active)
    foreground.stop()
    active.stop()
})

test("a full hide and show posts the four notifications in Apple's order, with the state each one sees", async function() {
    var Application = await freshApplication("visible")
    var log = recording(Application)
    setVisibility("hidden")
    setVisibility("visible")
    log.stop()
    assert.deepEqual([...log], [
        ["WillResignActive", Application.State.inactive],
        ["DidEnterBackground", Application.State.background],
        ["WillEnterForeground", Application.State.inactive],
        ["DidBecomeActive", Application.State.active],
    ])
})

test("a page that loaded hidden posts willEnterForeground and didBecomeActive when it is first shown, and no resign", async function() {
    var Application = await freshApplication("hidden")
    var log = recording(Application)
    setVisibility("visible")
    log.stop()
    assert.deepEqual([...log], [
        ["WillEnterForeground", Application.State.inactive],
        ["DidBecomeActive", Application.State.active],
    ])
    assert.equal(Application.shared.applicationState, Application.State.active)
})

test("a repeated event with the same visibility posts nothing", async function() {
    var Application = await freshApplication("visible")
    var log = recording(Application)
    setVisibility("visible")
    assert.equal(log.length, 0, "a visible event while active")
    setVisibility("hidden")
    setVisibility("hidden")
    assert.equal(log.length, 2, "one pair for the first hidden event")
    setVisibility("visible")
    setVisibility("visible")
    assert.equal(log.length, 4, "one pair for the first visible event")
    log.stop()
})

test("reading shared again and again installs nothing more: one event posts one notification", async function() {
    var Application = await freshApplication("visible")
    Application.shared
    Application.shared
    Application.shared
    var posts = observing(Application, Application.didEnterBackgroundNotification)
    setVisibility("hidden")
    assert.equal(posts.length, 1)
    posts.stop()
})

test("the entry evaluated twice on one document installs one listener and posts one notification per transition", async function() {
    var launched = launchDocument("visible")
    var listeners = 0
    var original = launched.addEventListener.bind(launched)
    launched.addEventListener = function(type, ...rest) {
        if (type === "visibilitychange") { listeners++ }
        return original(type, ...rest)
    }
    var first = await evaluateEntry()
    var second = await evaluateEntry()
    assert.notEqual(first, second, "two evaluations are two copies of the class")
    assert.equal(first.shared, second.shared, "the document has one application")
    assert.equal(listeners, 1)
    var log = recording(first)
    setVisibility("hidden")
    setVisibility("visible")
    log.stop()
    assert.deepEqual(log.map((entry) => entry[0]), ["WillResignActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive"])
})

test("two documents have one application each", async function() {
    var one = await freshApplication("visible")
    var two = await freshApplication("hidden")
    assert.notEqual(one.shared, two.shared)
    assert.equal(two.shared.applicationState, two.State.background)
})

test("the state follows a full hide and show cycle more than once", async function() {
    var Application = await freshApplication("visible")
    var app = Application.shared
    var log = recording(Application)
    for (var round = 0; round < 3; round++) {
        setVisibility("hidden")
        setVisibility("visible")
    }
    log.stop()
    assert.deepEqual(log.map((entry) => entry[0]), [
        "WillResignActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive",
        "WillResignActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive",
        "WillResignActive", "DidEnterBackground", "WillEnterForeground", "DidBecomeActive",
    ])
    assert.equal(app.applicationState, Application.State.active)
})
