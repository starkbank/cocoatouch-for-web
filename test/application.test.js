import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIApplication } from "../src/index.js"


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
