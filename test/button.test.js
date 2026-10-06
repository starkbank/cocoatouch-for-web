import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIButton, UIControlState } from "../src/index.js"


// Swift lets a subclass hold `var title` beside `title(for:)`; JavaScript has
// one namespace, so the field shadows the method on the instance, and the
// framework's own drawing must not go through it.
test("a UIButton subclass that declares its own title member still draws, redraws and reports its title", function() {
    class MenuItem extends UIButton {
        title = ""
    }
    page("<button id=\"item\"></button><button id=\"plain-title\"></button>")
    var item = new MenuItem("#item")
    item.title = "Overview"
    item.setTitle(item.title, {for: UIControlState.normal})
    assert.equal(item.$el.text(), "Overview")
    assert.equal(item.currentTitle, "Overview")
    item.isSelected = true
    item.isEnabled = false
    assert.equal(item.$el.text(), "Overview")
    assert.equal(item.currentTitle, "Overview")
    assert.equal(item.title, "Overview")
    var plain = new UIButton("#plain-title")
    plain.setTitle("Save", {for: UIControlState.normal})
    assert.equal(plain.title({for: UIControlState.normal}), "Save")
    assert.equal(plain.title({for: UIControlState.selected}), "Save")
})
