import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, UIToolTipInteraction } from "../src/index.js"


function viewOn(html) {
    page(html)
    return new UIView("#target")
}

test("addInteraction draws the tooltip as the element's tooltip attribute and lists the interaction", function() {
    var view = viewOn("<button id=\"target\" tooltip=\"flow-right\"></button>")
    assert.deepEqual(view.interactions, [])
    var interaction = new UIToolTipInteraction({defaultToolTip: "Copy the code"})
    view.addInteraction(interaction)
    assert.equal(document.getElementById("target").getAttribute("tooltip"), "Copy the code")
    assert.deepEqual(view.interactions, [interaction])
    assert.equal(interaction.view, view)
})

test("setting defaultToolTip redraws, and nil or empty text removes the attribute", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var interaction = new UIToolTipInteraction({defaultToolTip: "one"})
    view.addInteraction(interaction)
    interaction.defaultToolTip = "two"
    assert.equal(interaction.defaultToolTip, "two")
    assert.equal(document.getElementById("target").getAttribute("tooltip"), "two")
    interaction.defaultToolTip = null
    assert.equal(document.getElementById("target").hasAttribute("tooltip"), false)
    interaction.defaultToolTip = "three"
    interaction.defaultToolTip = ""
    assert.equal(document.getElementById("target").hasAttribute("tooltip"), false)
})

test("removeInteraction removes the attribute and the entry, and a later change draws nothing", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var interaction = new UIToolTipInteraction({defaultToolTip: "bye"})
    view.addInteraction(interaction)
    view.removeInteraction(interaction)
    assert.equal(document.getElementById("target").hasAttribute("tooltip"), false)
    assert.deepEqual(view.interactions, [])
    assert.equal(interaction.view, null)
    interaction.defaultToolTip = "ignored"
    assert.equal(document.getElementById("target").hasAttribute("tooltip"), false)
})

test("an interaction with no tooltip draws no attribute, and one view can be given the interaction before the text", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var interaction = new UIToolTipInteraction()
    assert.equal(interaction.defaultToolTip, null)
    view.addInteraction(interaction)
    assert.equal(document.getElementById("target").hasAttribute("tooltip"), false)
    interaction.defaultToolTip = "late"
    assert.equal(document.getElementById("target").getAttribute("tooltip"), "late")
})

test("adding the same interaction twice lists it once, and removing one that was never added does nothing", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var interaction = new UIToolTipInteraction({defaultToolTip: "x"})
    view.addInteraction(interaction)
    view.addInteraction(interaction)
    assert.equal(view.interactions.length, 1)
    view.removeInteraction(new UIToolTipInteraction({defaultToolTip: "y"}))
    assert.equal(document.getElementById("target").getAttribute("tooltip"), "x")
})

test("interactions is a copy: changing it does not add or remove anything", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var interaction = new UIToolTipInteraction({defaultToolTip: "x"})
    view.addInteraction(interaction)
    view.interactions.pop()
    assert.equal(view.interactions.length, 1)
})

test("the interaction is told it will move and did move, in that order, with the view and then nil", function() {
    var view = viewOn("<div id=\"target\"></div>")
    var log = []
    class Recording extends UIToolTipInteraction {
        willMove({to}) { log.push("will " + (to ? "view" : "nil")); super.willMove({to}) }
        didMove({to}) { log.push("did " + (to ? "view" : "nil")); super.didMove({to}) }
    }
    var interaction = new Recording({defaultToolTip: "x"})
    view.addInteraction(interaction)
    view.removeInteraction(interaction)
    assert.deepEqual(log, ["will view", "did view", "will nil", "did nil"])
})

test("a view that is not an interaction, a non-String tooltip and a missing to label are refused with a TypeError", function() {
    var view = viewOn("<div id=\"target\"></div>")
    assert.throws(() => view.addInteraction({}), (error) => error instanceof TypeError && /UIView\.addInteraction/.test(error.message))
    assert.throws(() => view.addInteraction(null), TypeError)
    assert.throws(() => new UIToolTipInteraction({defaultToolTip: 5}), (error) => error instanceof TypeError && /defaultToolTip/.test(error.message))
    var interaction = new UIToolTipInteraction()
    assert.throws(() => { interaction.defaultToolTip = 5 }, TypeError)
    assert.throws(() => interaction.willMove({}), (error) => error instanceof TypeError && /requires a to/.test(error.message))
})
