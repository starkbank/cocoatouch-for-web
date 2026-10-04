import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UISearchTextField, UISearchToken } from "../src/index.js"


test("removeToken(at:) removes that token and its tag, leaving the others in order", function() {
    page("<div id=\"search\"></div>")
    var field = new UISearchTextField("#search")
    field.tokens = [new UISearchToken({text: "a"}), new UISearchToken({text: "b"}), new UISearchToken({text: "c"})]
    assert.equal($("#search .tag").length, 3)
    field.removeToken({at: 1})
    assert.deepEqual(field.tokens.map((token) => token.text), ["a", "c"])
    assert.deepEqual($("#search .tag .tag-text").map(function() { return $(this).text() }).get(), ["a", "c"])
    assert.equal(field.tokens.length, 2)
})

// Every handler binds under its own namespace and removes it first, so a
// second construction on the same element leaves one of each, not two.
test("constructing a search field twice on one element leaves one click and one keydown handler", function() {
    page("<div id=\"search\"></div>")
    new UISearchTextField("#search")
    var second = new UISearchTextField("#search")
    var elementEvents = $._data($("#search")[0], "events")
    var inputEvents = $._data($("#search input")[0], "events")
    assert.equal(elementEvents.click.length, 1)
    assert.equal(inputEvents.keydown.length, 1)
    assert.equal($("#search input").length, 1)
    assert.ok(elementEvents.click.every((handler) => handler.namespace === "uisearchtextfield"))
    assert.ok(inputEvents.keydown.every((handler) => handler.namespace === "uisearchtextfield"))
    assert.equal(second.textField.length, 1)
})
