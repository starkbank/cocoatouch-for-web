import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UITextField, UIToolTipInteraction } from "../src/index.js"


function countQueries(body) {
    var names = ["getElementById", "querySelector", "querySelectorAll", "getElementsByClassName", "getElementsByTagName"]
    var originals = names.map((name) => document[name])
    var queries = 0
    names.forEach((name, index) => { document[name] = function() { queries++; return originals[index].apply(document, arguments) } })
    try {
        body()
    } finally {
        names.forEach((name, index) => { document[name] = originals[index] })
    }
    return queries
}

function twinTags() {
    page("<div id=\"host\"></div>")
    var host = new UIView("#host")
    var tags = [UIView.loadFromNib("<div class=\"tag\"></div>"), UIView.loadFromNib("<div class=\"tag\"></div>")]
    for (var tag of tags) {
        host.addSubview(tag)
        tag.accessibilityIdentifier = "same"
        tag.addInteraction(new UIToolTipInteraction({defaultToolTip: "tip"}))
    }
    return tags
}

test("removing a view whose tooltip shares an accessibilityIdentifier with a sibling leaves the sibling's tooltip", function() {
    var [first, second] = twinTags()
    assert.equal(first.$el[0].getAttribute("tooltip"), "tip")
    var secondElement = second.$el[0]
    first.removeFromSuperview()
    assert.equal(secondElement.getAttribute("tooltip"), "tip")
})

test("disposing a view that already left the page erases its tooltip without a document query", function() {
    var [first] = twinTags()
    var element = first.$el[0]
    element.remove()
    var queries = countQueries(() => first._dispose())
    assert.equal(queries, 0)
    assert.equal(element.hasAttribute("tooltip"), false)
})

test("disposing a text field that already left the page unbinds its paste handler without a document query", function() {
    page("<input id=\"name\">")
    var field = new UITextField("#name")
    var element = field.$el[0]
    var pasted = 0
    $(element).on("paste.uitextpaste", () => { pasted++ })
    element.remove()
    var queries = countQueries(() => field._dispose())
    assert.equal(queries, 0)
    element.dispatchEvent(new window.Event("paste"))
    assert.equal(pasted, 0)
})
