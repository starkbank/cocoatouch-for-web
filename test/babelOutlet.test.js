import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIView, IBOutlet, IBAction } from "../src/index.js"


// The apps compile their classes with Babel's legacy decorators, which read
// value, get, set and initializer off whatever a decorator returns. The
// fixture is that compiled output, kept so the framework suite sees what the
// apps' bundles do.
test("a Babel-compiled class with value, get, initializer and set accessors defines without running them, and its outlets bind", async function() {
    var { ValueView, reads } = await import("./fixtures/babel/valueView.js")
    assert.deepEqual(reads, [], "defining the class ran no accessor")
    page("<div id=\"root\"></div>")
    var view = new ValueView("#root")
    assert.deepEqual(reads, [])
    assert.ok(view.label instanceof UIView)
    assert.equal(view.label.$el[0], document.getElementById("label"))
    assert.equal(view.items.length, 2)
    assert.ok(view.seeded instanceof UIView, "an outlet with an initializer is bound over it")
    assert.equal(view.tapped(), "tapped")
    assert.equal(view.value, "value")
    assert.equal(view.get, "get")
    assert.equal(view.initializer, "initializer")
    view.set = 1
    assert.deepEqual(reads, ["value:instance", "get:instance", "initializer:instance", "set:instance"], "the accessors work, on the instance only")
})

test("IBOutlet and IBAction hand a transform a plain descriptor: a field's has no initializer, a method keeps its own", function() {
    var target = {}
    var field = {configurable: true, enumerable: true, writable: true, initializer: function() { return 1 }}
    var returned = IBOutlet("#a", UIView)(target, "a", field)
    assert.notEqual(returned, target)
    assert.equal(Object.getPrototypeOf(returned), Object.prototype)
    assert.equal(returned.initializer, undefined)
    assert.equal(returned.writable, true)
    assert.equal(Object.getPrototypeOf(IBOutlet("#b", UIView)(target, "b", undefined)), Object.prototype)
    assert.equal(target.iboutlets.length, 2)
    var method = {value: function() {}, writable: true, enumerable: false, configurable: true}
    assert.equal(IBAction("#c", UIView)({}, "c", method), method)
    assert.equal(IBAction("#d", UIView)({}, "d", undefined).initializer, undefined)
})
