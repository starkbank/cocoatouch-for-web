import "UIKit"
import "./uicomponents/index.js"
import "./uipages/index.js"
import { HomeViewController } from "./uipages/home/homeViewController.js"
import { ButtonsViewController } from "./uipages/buttons/buttonsViewController.js"
import { LabelsViewController } from "./uipages/labels/labelsViewController.js"
import { TextFieldsViewController } from "./uipages/textFields/textFieldsViewController.js"
import { CustomViewsViewController } from "./uipages/customViews/customViewsViewController.js"
import { TableViewViewController } from "./uipages/tableView/tableViewViewController.js"
import { LinksViewController } from "./uipages/links/linksViewController.js"
import { TraitsViewController } from "./uipages/traits/traitsViewController.js"
import { NavigationViewController } from "./uipages/navigation/navigationViewController.js"


const routes = {
    "/": HomeViewController,
    "/buttons": ButtonsViewController,
    "/labels": LabelsViewController,
    "/text-fields": TextFieldsViewController,
    "/custom-views": CustomViewsViewController,
    "/table-view": TableViewViewController,
    "/links": LinksViewController,
    "/traits": TraitsViewController,
    "/navigation": NavigationViewController,
    "/navigation/detail": NavigationViewController,
}

// The page hosts one root controller at a time. Presenting the next one
// dismisses the current one first, releasing everything it observed.
var current = null

export function present() {
    var Controller = routes[window.location.pathname] || HomeViewController
    current = new Controller()
    current.present(current)
}

// A navigation stack binds its own pushes to history, so a popstate that
// lands on an address the current stack serves is the stack's to handle.
window.addEventListener("popstate", function() {
    if (current instanceof UINavigationController && routes[window.location.pathname] === current.constructor) { return }
    present()
})
