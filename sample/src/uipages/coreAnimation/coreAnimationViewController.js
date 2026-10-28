import "UIKit"
import "Foundation"
import "CoreAnimation"
import { MenuView } from "../../uicomponents/menu/menuView.js"


const confettiDuration = 1200

// Half a turn a second.
const radiansPerSecond = Math.PI

const confettiColors = ["#0070e0", "#1f9d55", "#d64545", "#f2a900"]

// A named image is a file; the sample ships none, so the piece is inline. It is white
// because the cell's color tints it.
const pieceUrl = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 14"><rect width="8" height="14" rx="1" fill="#fff"/></svg>')


export class CoreAnimationViewController extends UIViewController {

    @IBOutlet("#menu", MenuView) menuView
    @IBOutlet("#core-animation-arm", UIView) armView
    @IBOutlet("#core-animation-start", UIButton) startButton
    @IBOutlet("#core-animation-frame", UILabel) frameLabel

    displayLink = null
    frameCount = 0
    angle = 0
    confettiLayer = null
    confettiTimer = null

    viewDidLoad() {
        this.confettiLayer = this.makeConfettiLayer()
        this.frameLabel.text = "Not running."
    }

    viewWillDisappear() {
        if (this.displayLink) { this.displayLink.invalidate() }
        this.displayLink = null
        clearTimeout(this.confettiTimer)
        this.confettiTimer = null
        this.confettiLayer.removeFromSuperlayer()
    }

    @IBAction("#core-animation-start", UIButton) startTapped() {
        if (!this.displayLink) {
            this.displayLink = new CADisplayLink({target: this, selector: this.step})
            this.displayLink.add({to: RunLoop.main, forMode: RunLoop.Mode.common})
            this.startButton.setTitle("Pause", {for: UIControl.State.normal})
            return
        }
        this.displayLink.isPaused = !this.displayLink.isPaused
        this.startButton.setTitle(this.displayLink.isPaused ? "Resume" : "Pause", {for: UIControl.State.normal})
    }

    // CADisplayLink calls the selector with the link, before every frame.
    step(link) {
        this.frameCount += 1
        this.angle += link.duration * radiansPerSecond
        this.armView.transform = new CGAffineTransform({rotationAngle: this.angle})
        this.frameLabel.text = `frame ${this.frameCount} · duration ${(link.duration * 1000).toFixed(1)} ms`
    }

    // The layer owns a canvas over the window that only shows once it is added to the key window's layer.
    @IBAction("#core-animation-confetti", UIButton) confettiTapped() {
        clearTimeout(this.confettiTimer)
        UIApplication.shared.keyWindow.layer.addSublayer(this.confettiLayer)
        this.confettiLayer.birthRate = 1
        this.confettiTimer = setTimeout(() => { this.confettiLayer.birthRate = 0 }, confettiDuration)
    }

    makeConfettiLayer() {
        const width = UIScreen.main.bounds.width
        const layer = new CAEmitterLayer()
        layer.emitterShape = CAEmitterLayerEmitterShape.line
        layer.emitterPosition = new CGPoint({x: width / 2, y: -10})
        layer.emitterSize = new CGSize({width, height: 1})
        layer.birthRate = 0
        layer.emitterCells = confettiColors.map(function(hex) {
            const cell = new CAEmitterCell()
            cell.color = new UIColor({hex}).cgColor
            cell.contents = new UIImage({named: pieceUrl})
            cell.birthRate = 40
            cell.lifetime = 3
            cell.velocity = 220
            cell.velocityRange = 80
            cell.emissionLongitude = Math.PI / 2
            cell.yAcceleration = 300
            cell.spin = 3
            cell.spinRange = 4
            cell.scale = 1
            cell.scaleRange = 0.4
            return cell
        })
        return layer
    }
}
