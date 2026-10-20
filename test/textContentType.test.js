import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { IBOutlet, UIView, UITextField, UISearchTextField, UITextContentType } from "../src/index.js"


// The table of the plan: Apple's case, then the WHATWG autocomplete token it draws.
const table = [
    ["oneTimeCode", "one-time-code"],
    ["newPassword", "new-password"],
    ["password", "current-password"],
    ["username", "username"],
    ["emailAddress", "email"],
    ["telephoneNumber", "tel"],
    ["name", "name"],
    ["givenName", "given-name"],
    ["familyName", "family-name"],
    ["organizationName", "organization"],
    ["postalCode", "postal-code"],
    ["fullStreetAddress", "street-address"],
    ["addressCity", "address-level2"],
    ["addressState", "address-level1"],
    ["countryName", "country-name"],
    ["creditCardNumber", "cc-number"],
    ["URL", "url"],
]

function field() {
    page("<input id=\"name\">")
    return new UITextField("#name")
}

function input() {
    return document.getElementById("name")
}

test("UITextContentType holds exactly the 17 cases this surface can honour, frozen, each its own name", function() {
    assert.deepEqual(Object.keys(UITextContentType).sort(), table.map(([name]) => name).sort())
    assert.ok(Object.isFrozen(UITextContentType))
    for (var [name] of table) { assert.equal(UITextContentType[name], name) }
})

test("each case draws its autocomplete token, and the getter reads the case back", function() {
    for (var [name, token] of table) {
        var textField = field()
        textField.textContentType = UITextContentType[name]
        assert.equal(input().getAttribute("autocomplete"), token, name)
        assert.equal(textField.textContentType, UITextContentType[name], name)
    }
})

test("nil removes the attribute, so the browser default returns, and reads back as null", function() {
    var textField = field()
    assert.equal(textField.textContentType, null)
    textField.textContentType = UITextContentType.newPassword
    textField.textContentType = null
    assert.equal(input().hasAttribute("autocomplete"), false)
    assert.equal(textField.textContentType, null)
    textField.textContentType = UITextContentType.username
    textField.textContentType = undefined
    assert.equal(input().hasAttribute("autocomplete"), false)
})

test("a value outside the type is refused with Apple's signature and leaves the attribute as it was", function() {
    var textField = field()
    textField.textContentType = UITextContentType.username
    for (var bad of ["off", "on", "new-password", "current-password", "birthdate", "Password", "", 7, {}, true]) {
        assert.throws(() => { textField.textContentType = bad }, (error) => error instanceof TypeError && /textContentType/.test(error.message) && /UITextContentType/.test(error.message), String(bad))
    }
    assert.equal(input().getAttribute("autocomplete"), "username")
})

test("a static autocomplete in the markup reads as the case it names, and as null when no case names it", function() {
    page("<input id=\"name\" autocomplete=\"new-password\">")
    assert.equal(new UITextField("#name").textContentType, UITextContentType.newPassword)
    page("<input id=\"name\" autocomplete=\"off\">")
    assert.equal(new UITextField("#name").textContentType, null)
})

test("it works on an outlet bound by a nib", function() {
    class Owner extends UIView {}
    Owner.nib = "<input id=\"owner-name\">"
    IBOutlet("#owner-name", UITextField)(Owner.prototype, "nameField", {})
    page("<div id=\"owner\"></div>")
    var owner = new Owner("#owner")
    owner.nameField.textContentType = UITextContentType.emailAddress
    assert.equal(document.getElementById("owner-name").getAttribute("autocomplete"), "email")
})

test("it works on a field created in code, set before and after it is placed", function() {
    class MadeField extends UITextField {}
    MadeField.nib = "<input class=\"made\">"
    page("<div id=\"box\"></div>")
    var box = new UIView("#box")
    var made = new MadeField()
    box.addSubview(made)
    made.textContentType = UITextContentType.telephoneNumber
    assert.equal(document.querySelector("#box input.made").getAttribute("autocomplete"), "tel")
})

test("a search field puts it on its inner input", function() {
    page("<div id=\"search\"></div>")
    var search = new UISearchTextField("#search")
    var inner = document.querySelector("#search input")
    search.textContentType = UITextContentType.password
    assert.equal(inner.getAttribute("autocomplete"), "current-password")
    assert.equal(document.getElementById("search").hasAttribute("autocomplete"), false)
    assert.equal(search.textContentType, UITextContentType.password)
    search.textContentType = null
    assert.equal(inner.hasAttribute("autocomplete"), false)
    assert.equal(search.textContentType, null)
    assert.throws(() => { search.textContentType = "off" }, TypeError)
})

test("the autocomplete attribute is written through the setters and nowhere else in the framework (a framework-made input may start with its own static one)", function() {
    var writes = []
    for (var directory of ["uikit", "foundation", "utils", "avkit", "coreanimation", "coregraphics", "coremedia", "pdfkit", "uniformtypeidentifiers"]) {
        var base = new URL("../src/" + directory + "/", import.meta.url)
        for (var file of readdirSync(base)) {
            if (!file.endsWith(".js")) { continue }
            var lines = readFileSync(new URL(file, base), "utf8").split("\n")
            lines.forEach((line, index) => { if (/(attr|removeAttr|setAttribute|removeAttribute)\(["']autocomplete/.test(line)) { writes.push(directory + "/" + file + ":" + line.trim()) } })
        }
    }
    var files = [...new Set(writes.map((entry) => entry.split(":")[0]))].sort()
    assert.deepEqual(files, ["uikit/uisearchtextfield.js", "uikit/uitextfield.js"], writes.join("\n"))
    assert.equal(writes.filter((entry) => entry.startsWith("uikit/uitextfield.js")).length, 3, "the setter's removal and write, and the getter's read")
    assert.equal(writes.filter((entry) => entry.startsWith("uikit/uisearchtextfield.js")).length, 3)
})
