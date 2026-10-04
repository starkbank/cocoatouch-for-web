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
