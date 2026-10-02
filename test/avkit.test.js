import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { AVPlayer, AVPlayerItem, AVURLAsset, AVPlayerLayer, AVLayerVideoGravity, AVPlayerViewController, NotificationCenter, CALayer, CMTime } from "../src/index.js"


// A <video> stand-in: the properties the player writes and the events it hears.
class FakeVideo extends EventTarget {

    constructor(tagName = "VIDEO") {
        super()
        this.tagName = tagName
        this.attributes = {}
        this.paused = true
        this.playbackRate = 1
        this.muted = false
        this.volume = 1
        this.currentTime = 0
        this.duration = NaN
        this.readyState = 0
        this.controls = false
        this.style = {}
        this.calls = []
    }

    set src(url) { this.attributes.src = url }
    get src() { return this.attributes.src }
    removeAttribute(name) { delete this.attributes[name] }
    play() { this.calls.push("play"); this.paused = false; return Promise.resolve() }
    pause() { this.calls.push("pause"); this.paused = true }
}

function layerOn(video) {
    var layer = new AVPlayerLayer()
    layer._boundElement = video
    return layer
}

test("AVPlayer(url:) wraps the url in an item and asset; replaceCurrentItem swaps what plays", function() {
    var player = new AVPlayer({url: "/a.mp4"})
    assert.ok(player.currentItem instanceof AVPlayerItem)
    assert.ok(player.currentItem.asset instanceof AVURLAsset)
    assert.equal(player.currentItem.asset.url, "/a.mp4")
    assert.equal(new AVPlayer().currentItem, null)
    var video = new FakeVideo()
    layerOn(video).player = player
    assert.equal(video.src, "/a.mp4")
    player.replaceCurrentItem({with: new AVPlayerItem({url: "/b.mp4"})})
    assert.equal(video.src, "/b.mp4")
    assert.equal(player.currentItem.asset.url, "/b.mp4")
    player.replaceCurrentItem({with: null})
    assert.equal(video.src, undefined)
})

test("attaching a layer writes only the source, so a muted autoplaying element keeps playing", function() {
    var video = new FakeVideo()
    video.muted = true
    video.paused = false
    layerOn(video).player = new AVPlayer({url: "/a.mp4"})
    assert.equal(video.muted, true)
    assert.equal(video.paused, false)
    assert.deepEqual(video.calls, [])
})

test("play, pause, rate, volume, mute and seek reach the element and read back from it", function() {
    var video = new FakeVideo()
    var player = new AVPlayer({url: "/a.mp4"})
    layerOn(video).player = player
    player.play()
    assert.deepEqual(video.calls, ["play"])
    assert.equal(player.rate, 1)
    player.rate = 2
    assert.equal(video.playbackRate, 2)
    player.pause()
    assert.equal(video.paused, true)
    assert.equal(player.rate, 0)
    player.isMuted = true
    player.volume = 0.5
    var finished = []
    player.seek({to: new CMTime({seconds: 12, preferredTimescale: 600}), completionHandler: (done) => finished.push(done)})
    video.dispatchEvent(new Event("seeked"))
    assert.equal(video.muted, true)
    assert.equal(video.volume, 0.5)
    assert.equal(player.currentTime().seconds, 12)
    assert.equal(player.currentTime().timescale, 600)
    assert.deepEqual(finished, [true])
    player.seek({to: CMTime.invalid, completionHandler: (done) => finished.push(done)})
    assert.deepEqual(finished, [true, false])
    assert.equal(new AVPlayer().currentTime().isValid, false)
    assert.equal(player.timeControlStatus, AVPlayer.TimeControlStatus.paused)
    video.readyState = 4
    player.play()
    assert.equal(player.timeControlStatus, AVPlayer.TimeControlStatus.playing)
})

test("settings made before a layer exists are applied when one attaches", function() {
    var player = new AVPlayer({url: "/a.mp4"})
    player.isMuted = true
    player.seek({to: new CMTime({seconds: 7, preferredTimescale: 600})})
    player.play()
    assert.equal(player.isMuted, true)
    assert.equal(player.rate, 1)
    assert.equal(player.currentTime().seconds, 0)
    var video = new FakeVideo()
    layerOn(video).player = player
    assert.equal(video.muted, true)
    assert.equal(video.currentTime, 7)
    assert.deepEqual(video.calls, ["play"])
})

test("the item reports status and duration, and the end of playback is a notification", function() {
    var video = new FakeVideo()
    var player = new AVPlayer({url: "/a.mp4"})
    var layer = layerOn(video)
    layer.player = player
    assert.equal(player.status, AVPlayer.Status.unknown)
    assert.equal(player.error, null)
    assert.equal(player.currentItem.duration.isIndefinite, true)
    video.duration = 30
    video.dispatchEvent(new Event("loadedmetadata"))
    assert.equal(player.currentItem.status, AVPlayerItem.Status.readyToPlay)
    assert.equal(player.status, AVPlayer.Status.readyToPlay)
    assert.equal(player.currentItem.duration.seconds, 30)
    assert.equal(player.currentItem.duration.isNumeric, true)
    var ended = []
    var observer = {}
    NotificationCenter.default.addObserver(observer, {name: AVPlayerItem.didPlayToEndTimeNotification, object: player.currentItem, selector: (n) => ended.push(n.object)})
    player.play()
    video.dispatchEvent(new Event("ended"))
    assert.equal(ended[0], player.currentItem)
    assert.equal(player._settings.rate, 0)
    NotificationCenter.default.removeObserver(observer)
    layer.player = null
    video.dispatchEvent(new Event("ended"))
    assert.equal(ended.length, 1)
    video.dispatchEvent(new Event("error"))
    assert.equal(player.currentItem.status, AVPlayerItem.Status.readyToPlay)
    var failing = new AVPlayer({url: "/missing.mp4"})
    var broken = new FakeVideo()
    layerOn(broken).player = failing
    broken.error = {code: 4}
    broken.dispatchEvent(new Event("error"))
    assert.equal(failing.currentItem.status, AVPlayerItem.Status.failed)
    assert.equal(failing.currentItem.error.code, 4)
    assert.equal(failing.status, AVPlayer.Status.unknown)
})

test("AVPlayerLayer(player:) makes its own element that a layer adds as a sublayer; gravity maps to object-fit", function() {
    var created = null
    globalThis.document.createElement = function(tag) { created = new FakeVideo(tag.toUpperCase()); return created }
    var layer = new AVPlayerLayer({player: new AVPlayer({url: "/a.mp4"})})
    assert.equal(created.src, "/a.mp4")
    assert.equal(layer.selector, "#" + created.id)
    assert.equal(layer.videoGravity, AVLayerVideoGravity.resizeAspect)
    layer.videoGravity = AVLayerVideoGravity.resizeAspectFill
    assert.equal(created.style.objectFit, "cover")
    assert.equal(layer.videoGravity, AVLayerVideoGravity.resizeAspectFill)
    assert.equal(layer.isReadyForDisplay, false)
    created.readyState = 2
    assert.equal(layer.isReadyForDisplay, true)
    var appended = []
    var host = $("<div></div>")
    host.append = function(element) { appended.push(element); return host }
    var previous = globalThis.$
    globalThis.$ = function() { return host }
    new CALayer("#host").addSublayer(layer)
    globalThis.$ = previous
    assert.equal(appended[0], created)
    delete globalThis.document.createElement
})

test("AVPlayerViewController bound to a <video> plays there and releases the player when disposed", function() {
    var video = new FakeVideo()
    var controller = new AVPlayerViewController("#page #hero-video")
    controller._$el = {0: video, length: 1}
    var player = new AVPlayer({url: "/hero.mp4"})
    controller.player = player
    assert.equal(video.src, "/hero.mp4")
    assert.equal(controller.player, player)
    controller.showsPlaybackControls = true
    assert.equal(video.controls, true)
    controller.videoGravity = AVLayerVideoGravity.resize
    assert.equal(video.style.objectFit, "fill")
    controller._dispose()
    assert.equal(controller.player, null)
    assert.equal(player._layers.length, 0)
    assert.equal(video.src, "/hero.mp4")
})

test("AVPlayerViewController bound to a container appends the <video> it plays in", function() {
    var appended = []
    var host = {0: {tagName: "DIV"}, length: 1}
    host.children = function() { return {length: 0, first: function() { return this }} }
    host.append = function($video) { appended.push($video); return host }
    var created = new FakeVideo()
    var previous = globalThis.$
    globalThis.$ = function(html) { return {0: created, length: 1, html: html} }
    var controller = new AVPlayerViewController("#page #box")
    controller._$el = host
    controller.player = new AVPlayer({url: "/box.mp4"})
    globalThis.$ = previous
    assert.equal(appended.length, 1)
    assert.equal(created.src, "/box.mp4")
})
