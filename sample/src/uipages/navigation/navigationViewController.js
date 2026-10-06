import "UIKit"
import { NavigationListViewController } from "./navigationListViewController.js"
import { NavigationDetailViewController } from "./navigationDetailViewController.js"


// The page's root is the stack itself. A fresh load on the detail address
// rebuilds the stack from the app's own routing, since the framework keeps no
// route table and does not guess a stack from a url.
export class NavigationViewController extends UINavigationController {

    constructor() {
        var list = new NavigationListViewController()
        super({rootViewController: list})
        this.delegate = list
        if (window.location.pathname === "/navigation/detail") {
            this.setViewControllers([list, new NavigationDetailViewController()], {animated: false})
        }
    }
}
