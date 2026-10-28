import { outletElementClass } from "../uikit/iboutlet.js"




export class Build {

    static html(viewController) {
        var nib = viewController.constructor.nib || ""
        var container = $(`<div id="${viewController.identifier}">${nib}</div>`)
        var outlets = viewController["iboutlets"] || []

        for (const outlet of outlets) {
            var outletNib = outletElementClass(outlet).nib || ""
            if (outletNib) {
                var selector = outlet.selector
                var parent = container.find(selector)
                parent.html(outletNib)
            }
        }
        return container.html()
    }
}
