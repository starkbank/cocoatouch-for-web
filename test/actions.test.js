import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { IBAction, IBOutlet, IBInspectable, UIView, UIButton, UIViewController } from "../src/index.js"
import { Bind } from "../src/utils/bind.js"


// jsdom's own prototypes, which are not Node's: the spy wraps what the framework calls.
function countQueries(work) {
    var count = 0
    var prototypes = [window.Element.prototype, window.Document.prototype]
    var originals = prototypes.map((prototype) => prototype.querySelectorAll)
    prototypes.forEach(function(prototype, i) {
        prototype.querySelectorAll = function(...args) {
            count += 1
            return originals[i].apply(this, args)
        }
    })
    try {
        work()
    } finally {
        prototypes.forEach((prototype, i) => { prototype.querySelectorAll = originals[i] })
    }
    return count
}

// A view with one UIButton action per selector; each handler records the sender it got.
function actionHost(selectors) {
    class Host extends UIView {
        received = []
    }
    selectors.forEach(function(selector, i) {
        Host.prototype["tap" + i] = function(sender) { this.received.push({method: "tap" + i, sender: sender}) }
        IBAction(selector, UIButton)(Host.prototype, "tap" + i, {})
    })
    return Host
}

function twoCards(actions) {
    var ids = Array.from({length: actions}, (_, i) => "a" + i)
    var markup = (card) => "<div id=\"" + card + "\">" + ids.map((id) => "<button id=\"" + id + "\"></button>").join("") + "</div>"
    page(markup("card-a") + markup("card-b"))
    var Card = actionHost(ids.map((id) => "#" + id))
    return [new Card("#card-a"), new Card("#card-b")]
}

test("binding the actions of a class costs no document query, however many actions it has", function() {
    var queriesFor = function(actions) {
        var cards = twoCards(actions)
        return countQueries(() => cards.forEach((card) => Bind.ibAction(card)))
    }
    var few = queriesFor(10)
    var many = queriesFor(40)
    assert.equal(many, few)
    assert.equal(few, 0)
})

test("binding class actions over many matching elements costs no query per sender", function() {
    var queriesFor = function(elements) {
        page("<div id=\"card\">" + "<a class=\"go\"></a>".repeat(elements) + "<i class=\"other\"></i></div>")
        var Card = actionHost([".go", ".other"])
        var card = new Card("#card")
        return countQueries(() => Bind.ibAction(card))
    }
    assert.equal(queriesFor(40), queriesFor(10))
})

test("the sender of an id action is the element of its own card, with its identifier", function() {
    page("<div id=\"card-a\"><button id=\"go\"></button></div><div id=\"card-b\"><button id=\"go\"></button></div>")
    var Card = actionHost(["#go"])
    var cardB = new Card("#card-b")
    Bind.ibAction(cardB)
    var inside = document.querySelectorAll("#go")[1]
    $(inside).trigger("click")
    assert.equal(cardB.received.length, 1)
    var sender = cardB.received[0].sender
    assert.ok(sender instanceof UIButton)
    assert.deepEqual(Array.from(sender.$el), [inside])
    assert.equal(sender.identifier, "go")
    assert.equal(sender.selector, "#card-b #go")
})

test("the senders of a class action are its matching elements, each named when it has no id", function() {
    page("<div id=\"card\"><a class=\"go\" id=\"first\"></a><a class=\"go\"></a><u><a class=\"go\"></a></u></div><a class=\"go\"></a>")
    var Card = actionHost([".go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    var inside = Array.from(document.querySelectorAll("#card .go"))
    assert.equal(inside.length, 3)
    inside.forEach((element) => $(element).trigger("click"))
    assert.equal(card.received.length, 3)
    card.received.forEach(function(entry, i) {
        assert.deepEqual(Array.from(entry.sender.$el), [inside[i]])
        assert.equal(entry.sender.identifier, inside[i].id)
    })
    assert.deepEqual(inside.map((element) => element.id), ["first", "card-tap0-1", "card-tap0-2"])
    $(document.querySelector("body > .go")).trigger("click")
    assert.equal(card.received.length, 3)
})

test("an action matching nothing binds no sender and leaves the others working", function() {
    page("<div id=\"card\"><b id=\"here\"></b></div>")
    var Card = actionHost(["#nothing", ".nothing", "#here"])
    var card = new Card("#card")
    Bind.ibAction(card)
    $("#here").trigger("click")
    assert.deepEqual(card.received.map((entry) => entry.method), ["tap2"])
})

test("one click runs the handler once, prevents the default and lets the event travel up", function() {
    page("<div id=\"outer\"><div id=\"card\"><b id=\"go\"></b><b id=\"filler\"></b></div></div>")
    var Card = actionHost(["#go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    var seenAbove = []
    document.getElementById("outer").addEventListener("click", (e) => seenAbove.push(e))
    var click = new window.MouseEvent("click", {bubbles: true, cancelable: true})
    document.getElementById("go").dispatchEvent(click)
    assert.equal(card.received.length, 1)
    assert.equal(click.defaultPrevented, true)
    assert.equal(seenAbove.length, 1)
    assert.equal(seenAbove[0], click)
})

test("binding the same card twice leaves one handler per element", function() {
    page("<div id=\"card\"><b id=\"go\"></b><b id=\"filler\"></b></div>")
    var Card = actionHost(["#go", "#filler"])
    var card = new Card("#card")
    Bind.ibAction(card)
    Bind.ibAction(card)
    $("#go").trigger("click")
    assert.equal(card.received.length, 1)
})

test("a control built by app code with a bare id has no lent element and still finds its own", function() {
    page("<div id=\"card-a\"><button id=\"go\"></button></div><div id=\"card-b\"><button id=\"go\"></button></div>")
    var button = new UIButton("#go")
    assert.equal(Bind._constructing, null)
    assert.deepEqual(Array.from(button.$el), [document.querySelector("#card-a #go")])
})

test("the lent element is gone once the sender is built, even when its init throws", function() {
    page("<div id=\"card\"><b id=\"go\"></b></div>")
    class Broken extends UIButton {
        init() { throw new Error("init") }
    }
    class Card extends UIView {
        tapped() {}
    }
    IBAction("#go", Broken)(Card.prototype, "tapped", {})
    assert.throws(() => Bind.ibAction(new Card("#card")), /init/)
    assert.equal(Bind._constructing, null)
})

test("a class action whose matches grow while an earlier sender binds reaches every match", function() {
    page("<div id=\"card\"><a id=\"go\"></a><i class=\"x\"></i><b id=\"filler\"></b></div>")
    class Nibbed extends UIButton {}
    Nibbed.nib = "<span class=\"x\"></span>"
    class Card extends UIView {
        received = []
        first() {}
        xs(sender) { this.received.push(sender) }
        filler() {}
    }
    IBAction("#go", Nibbed)(Card.prototype, "first", {})
    IBAction(".x", UIButton)(Card.prototype, "xs", {})
    IBAction("#filler", UIButton)(Card.prototype, "filler", {})
    var card = new Card("#card")
    Bind.ibAction(card)
    var matches = Array.from(document.querySelectorAll("#card .x"))
    assert.equal(matches.length, 2)
    matches.forEach((element) => $(element).trigger("click"))
    assert.equal(card.received.length, 2)
    assert.deepEqual(card.received.map((sender) => sender.$el[0]), matches)
})

test("a sender class with a nib is bound: its outlets, awakeFromNib and own actions run", function() {
    page("<div id=\"card\"><a id=\"go\"></a><b id=\"filler\"></b></div>")
    var log = []
    class FancyButton extends UIButton {
        awakeFromNib() { log.push("awake") }
    }
    FancyButton.nib = "<span class=\"icon\"></span>"
    IBOutlet(".icon", UIView)(FancyButton.prototype, "icon", {})
    var senders = []
    class Card extends UIView {
        tapped(sender) { senders.push(sender) }
        other() {}
    }
    IBAction("#go", FancyButton)(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    var card = new Card("#card")
    Bind.ibAction(card)
    assert.deepEqual(log, ["awake"])
    var span = document.querySelector("#go .icon")
    assert.equal(span.id, "go-icon")
    $("#go").trigger("click")
    assert.equal(senders.length, 1)
    assert.equal(senders[0].icon.identifier, "go-icon")
    assert.deepEqual(Array.from(senders[0].icon.$el), [span])
})

test("a sender class with a nib binds the actions it declares itself", function() {
    page("<div id=\"card\"><a id=\"go\"></a><b id=\"filler\"></b></div>")
    var inner = []
    class Chip extends UIButton {
        closeTapped(sender) { inner.push(sender) }
    }
    Chip.nib = "<i class=\"close\"></i>"
    IBAction(".close", UIButton)(Chip.prototype, "closeTapped", {})
    class Card extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", Chip)(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    Bind.ibAction(new Card("#card"))
    $("#go .close").trigger("click")
    assert.equal(inner.length, 1)
})

test("a sender class with inspectables receives its data attributes", function() {
    page("<div id=\"card\"><a id=\"go\" data-title=\"Pay\" data-count=\"3\"></a><b id=\"filler\"></b></div>")
    var seen = []
    class Badge extends UIButton {
        title = "none"
        count = 0
        awakeFromNib() { seen.push({title: this.title, count: this.count}) }
    }
    IBInspectable(Badge.prototype, "title", {})
    IBInspectable(Number)(Badge.prototype, "count", {})
    class Card extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", Badge)(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    Bind.ibAction(new Card("#card"))
    assert.deepEqual(seen, [{title: "Pay", count: 3}])
})

// A sender class carrying a nib, an outlet, an inspectable and an action of
// its own, each logging the hook that reaches it, so one deepEqual places the
// whole sequence a sender gets.
function hookedSender(log) {
    class Icon extends UIView {
        awakeFromNib() { log.push("icon.awakeFromNib") }
        didMoveToWindow() { log.push("icon.didMoveToWindow") }
    }
    class Inner extends UIButton {
        awakeFromNib() { log.push("inner.awakeFromNib") }
        didMoveToWindow() { log.push("inner.didMoveToWindow") }
    }
    class Fancy extends UIButton {
        set count(value) { log.push("count " + value) }
        awakeFromNib() { log.push("awakeFromNib") }
        didMoveToWindow() { log.push("didMoveToWindow") }
        closeTapped() {}
    }
    Fancy.nib = "<span class=\"icon\"></span><i class=\"close\"></i>"
    IBOutlet(".icon", Icon)(Fancy.prototype, "icon", {})
    IBInspectable(Number)(Fancy.prototype, "count", {})
    IBAction(".close", Inner)(Fancy.prototype, "closeTapped", {})
    return Fancy
}

var hookedMarkup = "<div id=\"card\"><a id=\"go\" data-count=\"3\"><span class=\"icon\"></span><i class=\"close\"></i></a><b id=\"filler\"></b></div>"

test("a sender bound fresh gets its outlets' awakeFromNib, its inspectables, its own awakeFromNib, then its actions' senders", function() {
    var log = []
    page("<div id=\"card\"><a id=\"go\" data-count=\"3\"></a><b id=\"filler\"></b></div>")
    class Card extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", hookedSender(log))(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    Bind.ibAction(new Card("#card"))
    assert.deepEqual(log, ["icon.awakeFromNib", "count 3", "awakeFromNib", "inner.awakeFromNib"])
})

test("a sender restored over pre-rendered html gets didMoveToWindow in place of awakeFromNib, down its own actions too", function() {
    var log = []
    page("<cocoatouch>" + hookedMarkup + "</cocoatouch>")
    class Card extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", hookedSender(log))(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    Bind.ibAction(new Card("#card"), {isRestoring: true})
    assert.deepEqual(log, ["icon.didMoveToWindow", "count 3", "didMoveToWindow", "inner.didMoveToWindow"])
})

test("a restored view revived from its registered class restores the senders of its actions", function() {
    Bind._restorePrototypes.clear()
    var log = []
    class Chip extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", hookedSender(log))(Chip.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Chip.prototype, "other", {})
    Bind._restorePrototypes.clear()
    Bind.registerPrototypeForRestore(Chip.prototype)
    class Controller extends UIViewController {}
    page("<cocoatouch>" + hookedMarkup + "</cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    assert.deepEqual(log, ["icon.didMoveToWindow", "count 3", "didMoveToWindow", "inner.didMoveToWindow"])
})

test("an outlet restored with actions restores the senders of those actions", function() {
    var log = []
    class Card extends UIView {
        tapped() {}
        other() {}
    }
    IBAction("#go", hookedSender(log))(Card.prototype, "tapped", {})
    IBAction("#filler", UIButton)(Card.prototype, "other", {})
    class Controller extends UIViewController {}
    IBOutlet("#card", Card)(Controller.prototype, "card", {})
    Bind._restorePrototypes.clear()
    page("<cocoatouch>" + hookedMarkup + "</cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    assert.deepEqual(log, ["icon.didMoveToWindow", "count 3", "didMoveToWindow", "inner.didMoveToWindow"])
})

test("a restored page binds the action of a revived view to its own element, once per click", function() {
    Bind._restorePrototypes.clear()
    var taps = []
    class Chip extends UIView {
        closeTapped(sender) { taps.push(sender) }
    }
    IBAction(".chip-close", UIButton)(Chip.prototype, "closeTapped", {})
    class Controller extends UIViewController {}
    page("<cocoatouch><div class=\"chip\"><a class=\"chip-close\" id=\"close-1\"></a></div></cocoatouch>")
    var controller = new Controller()
    controller.restore(controller)
    var queries = countQueries(() => $("#close-1").trigger("click"))
    assert.equal(taps.length, 1)
    assert.equal(taps[0].identifier, "close-1")
    assert.deepEqual(Array.from(taps[0].$el), [document.getElementById("close-1")])
    assert.equal(queries, 0)
})
