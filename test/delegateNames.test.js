import test from "node:test"
import assert from "node:assert/strict"
import { rejectRetiredDelegateNames } from "../src/utils/delegateNames.js"


test("each refusal quotes the version its caller says retired the name", function() {
    var renames = {oldName: "newName"}
    var object = {oldName() {}}
    assert.throws(
        () => rejectRetiredDelegateNames(object, renames, "Owner.delegate", "1.9.0"),
        (error) => error instanceof TypeError && error.message === "Owner.delegate: oldName was renamed newName in cocoatouch 1.9.0; implement newName instead",
    )
    assert.throws(
        () => rejectRetiredDelegateNames(object, renames, "Owner.delegate", "1.6.0"),
        (error) => /in cocoatouch 1\.6\.0;/.test(error.message),
    )
})

test("an object without a retired name, or none at all, passes", function() {
    assert.doesNotThrow(() => rejectRetiredDelegateNames({newName() {}}, {oldName: "newName"}, "Owner.delegate", "1.9.0"))
    assert.doesNotThrow(() => rejectRetiredDelegateNames(null, {oldName: "newName"}, "Owner.delegate", "1.9.0"))
    assert.doesNotThrow(() => rejectRetiredDelegateNames({oldName: 3}, {oldName: "newName"}, "Owner.delegate", "1.9.0"))
})
