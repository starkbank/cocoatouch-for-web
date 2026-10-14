import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { NSString } from "../src/index.js"


test("NSString.CompareOptions exposes exactly the four cases this package honours, frozen", function() {
    assert.deepEqual(Object.keys(NSString.CompareOptions).sort(), ["backwards", "caseInsensitive", "diacriticInsensitive", "literal"])
    assert.equal(NSString.CompareOptions.caseInsensitive, "caseInsensitive")
    assert.equal(Object.isFrozen(NSString.CompareOptions), true)
    assert.equal(Object.isFrozen(NSString), true)
})

test("NSString is a namespace, not a string implementation: it cannot be constructed", function() {
    assert.throws(function() { new NSString() }, TypeError)
})
