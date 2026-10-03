import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"


test("page() resets the document body and the real jQuery sees it", function() {
    var $root = page("<cocoatouch></cocoatouch>")
    assert.equal($("cocoatouch").length, 1)
    assert.equal($root.find("cocoatouch").length, 1)
    page("<div id=\"a\"><p class=\"inner\"></p><p class=\"inner\"></p></div>")
    assert.equal($("cocoatouch").length, 0)
    assert.equal($("#a").find(".inner").length, 2)
})

test("the real jQuery parses html and counts children", function() {
    assert.equal($("<div></div>").html("<p></p><p></p>").children().length, 2)
})
