// The source of valueView.js, compiled by the legacy-decorator Babel setup the
// apps use (@babel/preset-env with modules: false, plugin-proposal-decorators
// {legacy: true}, plugin-proposal-class-properties). The compiled file is the
// fixture, so the framework suite needs no Babel; to regenerate it, run
// test/fixtures/babel/compile.mjs from a checkout that has those packages.
import { UIView, UIButton, IBOutlet, IBAction } from "../../../src/index.js"


export var reads = []

export class ValueView extends UIView {
    @IBOutlet("#label", UIView) label
    @IBOutlet(".item", [UIView]) items
    @IBOutlet("#seeded", UIView) seeded = "initial"

    @IBAction("#go", UIButton) tapped() {
        return "tapped"
    }

    get value() {
        reads.push(this === ValueView.prototype ? "value:prototype" : "value:instance")
        return "value"
    }

    get get() {
        reads.push(this === ValueView.prototype ? "get:prototype" : "get:instance")
        return "get"
    }

    get initializer() {
        reads.push(this === ValueView.prototype ? "initializer:prototype" : "initializer:instance")
        return "initializer"
    }

    set set(value) {
        reads.push(this === ValueView.prototype ? "set:prototype" : "set:instance")
    }
}

ValueView.nib = "<span id=\"label\"></span><i class=\"item\"></i><i class=\"item\"></i><b id=\"seeded\"></b><button id=\"go\"></button>"
