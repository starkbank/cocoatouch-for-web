import "UIKit"
import { MenuView } from "../../uicomponents/menu/menuView.js"


const savingDuration = 1500

const placements = [
    {edge: NSDirectionalRectEdge.leading, name: "leading"},
    {edge: NSDirectionalRectEdge.trailing, name: "trailing"},
    {edge: NSDirectionalRectEdge.top, name: "top"},
    {edge: NSDirectionalRectEdge.bottom, name: "bottom"},
]

const palette = [
    new UIColor({hex: "#0070e0"}),
    new UIColor({hex: "#1f9d55"}),
    new UIColor({hex: "#d64545"}),
    new UIColor({hex: "#f2a900"}),
]


export class ControlsViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#controls-save", UIButton) saveButton
    @IBOutlet("#controls-placement", UIButton) placementButton
    @IBOutlet("#controls-placement-output", UILabel) placementOutputLabel
    @IBOutlet("#controls-tooltip-switch", UISwitch) tooltipSwitch
    @IBOutlet("#controls-well", UIColorWell) colorWell
    @IBOutlet(".controls-swatch", [UIButton]) swatches
    @IBOutlet("#controls-preview", UIView) previewView
    @IBOutlet("#controls-color-output", UILabel) colorOutputLabel

    placementIndex = 0
    saveTimer = null
    toolTip = new UIToolTipInteraction({defaultToolTip: "Saves after a second and a half"})

    viewDidLoad() {
        this.saveButton.configuration.image = new UIImage({systemName: "fa-solid fa-cloud-arrow-up"})
        this.saveButton.addInteraction(this.toolTip)
        this.tooltipSwitch.addTarget(this, {action: this.tooltipSwitchChanged, for: UIControlEvent.valueChanged})
        for (const [index, swatch] of this.swatches.entries()) {
            swatch.backgroundColor = palette[index]
        }
        this.showColor(palette[0], {selecting: this.swatches[0]})
        this.colorWell.selectedColor = palette[0]
        this.placementOutputLabel.text = "imagePlacement NSDirectionalRectEdge.leading"
    }

    viewWillDisappear() {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
    }

    @IBAction("#controls-save", UIButton) saveTapped() {
        this.saveButton.isEnabled = false
        this.saveButton.configuration.showsActivityIndicator = true
        this.saveTimer = setTimeout(() => this.finishSaving(), savingDuration)
    }

    finishSaving() {
        this.saveButton.configuration.showsActivityIndicator = false
        this.saveButton.isEnabled = true
        this.saveTimer = null
    }

    @IBAction("#controls-placement", UIButton) placementTapped() {
        this.placementIndex = (this.placementIndex + 1) % placements.length
        const placement = placements[this.placementIndex]
        this.saveButton.configuration.imagePlacement = placement.edge
        this.placementOutputLabel.text = `imagePlacement NSDirectionalRectEdge.${placement.name}`
    }

    // addTarget actions receive the sender alone, and this is the target; see the Buttons page.
    tooltipSwitchChanged(sender) {
        if (sender.isOn) {
            this.saveButton.addInteraction(this.toolTip)
            return
        }
        this.saveButton.removeInteraction(this.toolTip)
    }

    // One action for every swatch: the sender is the element of the collection that was tapped.
    @IBAction(".controls-swatch", UIButton) swatchTapped(sender) {
        const color = palette[this.swatches.indexOf(sender)]
        this.colorWell.selectedColor = color
        this.showColor(color, {selecting: sender})
    }

    @IBAction("#controls-well", UIColorWell) colorPicked(sender) {
        this.showColor(sender.selectedColor, {selecting: null})
    }

    showColor(color, {selecting}) {
        this.previewView.backgroundColor = color
        this.colorOutputLabel.text = `selectedColor ${color.hex}`
        for (const swatch of this.swatches) {
            swatch.isSelected = swatch === selecting
        }
    }
}
