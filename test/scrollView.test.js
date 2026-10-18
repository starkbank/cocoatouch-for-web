import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIScrollView, UIViewController, IBOutlet, NotificationCenter } from "../src/index.js"


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
