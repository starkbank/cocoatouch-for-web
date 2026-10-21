import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIScrollView, UIView, UIViewController, IBOutlet, NotificationCenter } from "../src/index.js"


function scroll(element) {
    element.dispatchEvent(new window.Event("scroll"))
}

test("a delegate's scrollViewDidScroll receives the scroll view on every scroll of its element", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    var received = []
    scrollView.delegate = {scrollViewDidScroll(sender) { received.push(sender) }}
    scroll(scrollView.$el[0])
    scroll(scrollView.$el[0])
    assert.deepEqual(received, [scrollView, scrollView])
})

test("the delegate reads the offset the scroll left", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    var offsets = []
    scrollView.delegate = {scrollViewDidScroll(sender) { offsets.push(sender.contentOffset.x) }}
    Object.defineProperty(scrollView.$el[0], "scrollLeft", {value: 120, configurable: true})
    scroll(scrollView.$el[0])
    assert.deepEqual(offsets, [120])
})

test("a scroll of another element is not this scroll view's", function() {
    page("<div id=\"list\"></div><div id=\"other\"></div>")
    var scrollView = new UIScrollView("#list")
    var count = 0
    scrollView.delegate = {scrollViewDidScroll() { count += 1 }}
    scroll(document.getElementById("other"))
    assert.equal(count, 0)
})

test("setting the delegate again replaces the previous one, and nil stops the observation", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    var log = []
    scrollView.delegate = {scrollViewDidScroll() { log.push("first") }}
    scrollView.delegate = {scrollViewDidScroll() { log.push("second") }}
    scroll(scrollView.$el[0])
    scrollView.delegate = null
    scroll(scrollView.$el[0])
    assert.deepEqual(log, ["second"])
    assert.equal(scrollView.delegate, null)
})

test("a delegate without scrollViewDidScroll observes nothing and the delegate reads back", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    var delegate = {}
    scrollView.delegate = delegate
    assert.doesNotThrow(function() { scroll(scrollView.$el[0]) })
    assert.equal(scrollView.delegate, delegate)
})

test("dismissing the owning controller releases the scroll listener", function() {
    page("<cocoatouch id=\"container\"></cocoatouch>")
    var count = 0
    class Owner extends UIViewController {
        static nib = '<div id="list"></div>'

        viewDidLoad() {
            this.list.delegate = {scrollViewDidScroll() { count += 1 }}
        }
    }
    IBOutlet("#list", UIScrollView)(Owner.prototype, "list")
    var owner = new Owner()
    owner.present(owner)
    return new Promise(function(resolve) { setTimeout(resolve, 0) }).then(function() {
        var element = document.getElementById("list")
        scroll(element)
        assert.equal(count, 1)
        owner._dispose()
        scroll(element)
        assert.equal(count, 1)
    })
})

test("the scroll observer is registered with NotificationCenter against the element, so a controller disposal reaches it", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    scrollView.delegate = {scrollViewDidScroll() {}}
    NotificationCenter.default.removeObserver(scrollView)
    var count = 0
    scrollView.delegate = {scrollViewDidScroll() { count += 1 }}
    scroll(scrollView.$el[0])
    assert.equal(count, 1)
})

// isScrollEnabled is read live from the computed overflow, so a media query's
// change is seen, and written as an inline overflow the stylesheet's returns
// from when it is turned back on.
function withRule(rule, run) {
    var style = document.createElement("style")
    style.textContent = rule
    document.head.appendChild(style)
    try { run(style) } finally { style.remove() }
}

test("isScrollEnabled is true when either axis computes to auto or scroll, and false for hidden and visible", function() {
    page("<div id=\"s\"></div>")
    var view = new UIScrollView("#s")
    var element = document.getElementById("s")
    var cases = [
        ["auto", "auto", true], ["scroll", "scroll", true], ["hidden", "hidden", false],
        ["visible", "visible", false], ["auto", "hidden", true], ["hidden", "scroll", true], ["clip", "clip", false],
    ]
    for (var [x, y, expected] of cases) {
        element.style.overflowX = x
        element.style.overflowY = y
        assert.equal(view.isScrollEnabled, expected, x + " " + y)
    }
})

test("the page's own scroller reads true while its overflow is visible, because the viewport scrolls it", function() {
    page("<div></div>")
    var html = new UIScrollView("html")
    var body = new UIScrollView("body")
    assert.equal(html.isScrollEnabled, true)
    assert.equal(body.isScrollEnabled, true)
    document.body.style.overflowX = "hidden"
    document.body.style.overflowY = "hidden"
    assert.equal(body.isScrollEnabled, false)
    document.body.style.overflowX = ""
    document.body.style.overflowY = ""
})

test("isScrollEnabled follows a stylesheet change as it happens", function() {
    page("<div id=\"s\"></div>")
    var view = new UIScrollView("#s")
    withRule("#s { overflow-x: hidden; overflow-y: hidden; }", function(style) {
        assert.equal(view.isScrollEnabled, false)
        style.textContent = "#s { overflow-x: auto; overflow-y: auto; }"
        assert.equal(view.isScrollEnabled, true)
        style.textContent = "#s { overflow-x: hidden; overflow-y: hidden; }"
        assert.equal(view.isScrollEnabled, false)
    })
})

test("isScrollEnabled = false draws an inline overflow: hidden and reads false; true removes it, so the stylesheet's overflow returns", function() {
    page("<div id=\"s\"></div>")
    var view = new UIScrollView("#s")
    var element = document.getElementById("s")
    withRule("#s { overflow-x: auto; overflow-y: auto; }", function() {
        assert.equal(view.isScrollEnabled, true)
        view.isScrollEnabled = false
        assert.deepEqual([element.style.overflowX, element.style.overflowY], ["hidden", "hidden"])
        assert.equal(view.isScrollEnabled, false)
        view.isScrollEnabled = true
        assert.deepEqual([element.style.overflowX, element.style.overflowY], ["", ""])
        assert.equal(element.getAttribute("style") || "", "")
        assert.equal(view.isScrollEnabled, true)
    })
})

test("isScrollEnabled = true reads what the stylesheet then says, so a stylesheet that hides it still reads false", function() {
    page("<div id=\"s\"></div>")
    var view = new UIScrollView("#s")
    withRule("#s { overflow-x: hidden; overflow-y: hidden; }", function() {
        view.isScrollEnabled = true
        assert.equal(view.isScrollEnabled, false)
    })
})

test("isScrollEnabled is set on the page's own scroller too, and takes only a Bool", function() {
    page("<div></div>")
    var body = new UIScrollView("body")
    body.isScrollEnabled = false
    assert.equal(document.body.style.overflowX, "hidden")
    assert.equal(body.isScrollEnabled, false)
    body.isScrollEnabled = true
    assert.equal(document.body.style.overflowX, "")
    assert.equal(body.isScrollEnabled, true)
    assert.throws(() => { body.isScrollEnabled = "no" }, (error) => error instanceof TypeError && /UIScrollView\.isScrollEnabled/.test(error.message))
    assert.equal(body.isScrollEnabled, true)
})


// scroll does not bubble, so the page scroller's event reaches only the document.
// The spy counts what this scroll view left on the document: add minus remove.
function spyOnDocumentScroll() {
    var add = document.addEventListener
    var remove = document.removeEventListener
    var live = new Set()
    document.addEventListener = function(name, callback, options) {
        if (name === "scroll") { live.add(callback) }
        return add.call(this, name, callback, options)
    }
    document.removeEventListener = function(name, callback, options) {
        if (name === "scroll") { live.delete(callback) }
        return remove.call(this, name, callback, options)
    }
    return {
        live: live,
        restore: function() {
            document.addEventListener = add
            document.removeEventListener = remove
        }
    }
}

test("the page scroller's delegate follows the document, and each reassignment leaves no listener behind", function() {
    page("<div></div>")
    var spy = spyOnDocumentScroll()
    try {
        var scrollView = new UIScrollView("html")
        var log = []
        scrollView.delegate = {scrollViewDidScroll() { log.push("first") }}
        assert.equal(spy.live.size, 1)
        scroll(document)
        scrollView.delegate = {scrollViewDidScroll() { log.push("second") }}
        assert.equal(spy.live.size, 1)
        scroll(document)
        scrollView.delegate = null
        assert.equal(spy.live.size, 0)
        scroll(document)
        assert.deepEqual(log, ["first", "second"])
    } finally { spy.restore() }
})

test("an html-bound and a body-bound scroll view both observe the document", function() {
    page("<div></div>")
    for (var selector of ["body", "html"]) {
        var count = 0
        var scrollView = new UIScrollView(selector)
        scrollView.delegate = {scrollViewDidScroll(sender) { count += (sender === scrollView ? 1 : 0) }}
        scroll(document)
        assert.equal(count, 1, selector)
        scrollView.delegate = null
    }
})

test("an element-bound scroll view is unchanged: it observes its element and leaves the document alone", function() {
    page("<div id=\"list\"></div>")
    var spy = spyOnDocumentScroll()
    try {
        var scrollView = new UIScrollView("#list")
        var count = 0
        scrollView.delegate = {scrollViewDidScroll() { count += 1 }}
        assert.equal(spy.live.size, 0)
        scroll(document)
        assert.equal(count, 0)
        scroll(scrollView.$el[0])
        assert.equal(count, 1)
    } finally { spy.restore() }
})

test("disposing a page scroller removes its document listener", function() {
    page("<div></div>")
    var spy = spyOnDocumentScroll()
    try {
        var scrollView = new UIScrollView("html")
        var count = 0
        scrollView.delegate = {scrollViewDidScroll() { count += 1 }}
        assert.equal(spy.live.size, 1)
        scrollView._dispose()
        assert.equal(spy.live.size, 0)
        scroll(document)
        assert.equal(count, 0)
    } finally { spy.restore() }
})

test("a delegate without scrollViewDidScroll leaves the document alone on a page scroller", function() {
    page("<div></div>")
    var spy = spyOnDocumentScroll()
    try {
        var scrollView = new UIScrollView("html")
        scrollView.delegate = {}
        assert.equal(spy.live.size, 0)
    } finally { spy.restore() }
})

// A scroll view made in code has no element until addSubview places it, and the
// delegate is set before that, as Apple's init-then-configure order goes.
function listClass() {
    class List extends UIScrollView {}
    List.nib = "<div id=\"made\"></div>"
    return List
}

test("a delegate set before the scroll view is placed hears the scrolls after addSubview", function() {
    page("<div id=\"stage\"></div>")
    var stage = new UIView("#stage")
    var list = new (listClass())()
    var received = []
    list.delegate = {scrollViewDidScroll(sender) { received.push(sender) }}
    stage.addSubview(list)
    scroll(document.getElementById("made"))
    assert.deepEqual(received, [list])
})

test("a second placement of the scroll view does not double the scroll callback", function() {
    page("<div id=\"one\"></div><div id=\"two\"></div>")
    var one = new UIView("#one")
    var two = new UIView("#two")
    var list = new (listClass())()
    var count = 0
    list.delegate = {scrollViewDidScroll() { count += 1 }}
    one.addSubview(list)
    two.addSubview(list)
    list.didMoveToSuperview()
    scroll(list.$el[0])
    assert.equal(count, 1)
})

test("removing the scroll view from its superview leaves the center no observer for it", function() {
    page("<div id=\"stage\"></div>")
    var stage = new UIView("#stage")
    var list = new (listClass())()
    list.delegate = {scrollViewDidScroll() {}}
    stage.addSubview(list)
    assert.equal(NotificationCenter.default._observers.has(list), true)
    list.removeFromSuperview()
    assert.equal(NotificationCenter.default._observers.has(list), false)
})

test("didMoveToSuperview with no superview observes nothing, since the view is not in the page", function() {
    page("<div id=\"list\"></div>")
    var scrollView = new UIScrollView("#list")
    scrollView.delegate = {scrollViewDidScroll() {}}
    NotificationCenter.default.removeObserver(scrollView)
    scrollView.didMoveToSuperview()
    assert.equal(NotificationCenter.default._observers.has(scrollView), false)
})
