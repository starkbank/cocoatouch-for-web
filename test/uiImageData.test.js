import { page } from "./dom.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UIImage, UIImageView } from "../src/index.js"


var signatures = {
    png: {mime: "image/png", head: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]},
    jpeg: {mime: "image/jpeg", head: [0xFF, 0xD8, 0xFF, 0xE0]},
    gif87: {mime: "image/gif", head: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]},
    gif89: {mime: "image/gif", head: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]},
    webp: {mime: "image/webp", head: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]},
}

function bytesOf(kind, extra = [1, 2, 3, 250, 255, 0, 7]) {
    return new Uint8Array([...signatures[kind].head, ...extra])
}

function decode(url) {
    var match = /^data:([^;]+);base64,(.*)$/s.exec(url)
    return {mime: match[1], bytes: new Uint8Array(Buffer.from(match[2], "base64"))}
}

function dataURL(image) {
    page("<img id=\"photo\">")
    var view = new UIImageView("#photo")
    view.image = image
    return document.getElementById("photo").getAttribute("src")
}

test("PNG, JPEG, GIF and WebP are each sniffed to their MIME type, and the data URL round-trips the exact bytes", function() {
    for (var kind of Object.keys(signatures)) {
        var bytes = bytesOf(kind)
        var {mime, bytes: decoded} = decode(dataURL(new UIImage({data: bytes})))
        assert.equal(mime, signatures[kind].mime, kind)
        assert.deepEqual([...decoded], [...bytes], kind)
    }
})

test("UIImageView.image = UIImage(data:) sets an img's source, and paints another element as a background", function() {
    var bytes = bytesOf("png")
    page("<img id=\"photo\"><div id=\"box\"></div>")
    new UIImageView("#photo").image = new UIImage({data: bytes})
    assert.match(document.getElementById("photo").getAttribute("src"), /^data:image\/png;base64,/)
    new UIImageView("#box").image = new UIImage({data: bytes})
    assert.match(document.getElementById("box").style.backgroundImage, /data:image\/png;base64,/)
})

test("no object URL is made, so nothing needs revoking", function() {
    var made = []
    var original = URL.createObjectURL
    URL.createObjectURL = function() { made.push(1); return "blob:x" }
    try { dataURL(new UIImage({data: bytesOf("jpeg")})) } finally { URL.createObjectURL = original }
    assert.deepEqual(made, [])
})

test("an ArrayBuffer is read whole, and a view with an offset reads only the view's bytes", function() {
    var png = bytesOf("png", [9, 8, 7, 6])
    var padded = new Uint8Array([200, 201, ...png, 202])
    var fromBuffer = decode(dataURL(new UIImage({data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength)})))
    assert.deepEqual([...fromBuffer.bytes], [...png])
    var fromView = decode(dataURL(new UIImage({data: new Uint8Array(padded.buffer, 2, png.length)})))
    assert.deepEqual([...fromView.bytes], [...png])
    assert.equal(fromView.mime, "image/png")
})

test("a Node Buffer, a Uint8Array subclass, is accepted like its bytes", function() {
    var png = bytesOf("png")
    assert.deepEqual([...decode(dataURL(new UIImage({data: Buffer.from(png)}))).bytes], [...png])
})

test("input that is not bytes is refused with the TypeError naming Apple's failable init", function() {
    for (var refused of ["\x89PNG\r\n\x1a\n", "data:image/png;base64,iVBORw0KGgo=", "/photo.png", new URL("http://localhost/a.png"), [0x89, 0x50, 0x4E, 0x47], null, 7, {}, new Uint16Array(4), new DataView(new ArrayBuffer(8))]) {
        assert.throws(() => new UIImage({data: refused}), (error) => error instanceof TypeError && /UIImage\(data:\)/.test(error.message), String(refused))
    }
})

test("bytes that are no supported image are refused: empty, unknown, truncated signatures and SVG", function() {
    var text = (string) => new TextEncoder().encode(string)
    var refused = [
        new Uint8Array(0), new ArrayBuffer(0),
        text("hello"), new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        new Uint8Array([0x89, 0x50, 0x4E]), new Uint8Array([0xFF, 0xD8]),
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]),
        text("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"), text("<?xml version=\"1.0\"?><svg/>"),
        text("%PDF-1.7"), text("BM......"),
    ]
    for (var bytes of refused) {
        assert.throws(() => new UIImage({data: bytes}), (error) => error instanceof TypeError && /UIImage\(data:\)/.test(error.message))
    }
})

test("exactly one of named, systemName and data is taken", function() {
    var png = bytesOf("png")
    assert.throws(() => new UIImage({data: png, named: "/a.png"}), (error) => error instanceof TypeError && /UIImage\(data:\)/.test(error.message))
    assert.throws(() => new UIImage({data: png, systemName: "fas fa-x"}), TypeError)
    assert.throws(() => new UIImage({named: "/a.png", systemName: "fas fa-x"}), TypeError)
    assert.throws(() => new UIImage({}), TypeError)
    assert.throws(() => new UIImage(), TypeError)
    assert.equal(new UIImage({named: "/a.png"}).named, "/a.png")
    assert.equal(new UIImage({systemName: "fas fa-x"}).systemName, "fas fa-x")
    assert.equal(new UIImage({data: png}).named, undefined)
})

test("a 2 MB image encodes without a stack overflow, and round-trips", function() {
    var big = new Uint8Array(2 * 1024 * 1024)
    for (var index = 0; index < big.length; index++) { big[index] = (index * 31 + 7) & 255 }
    big.set(signatures.png.head)
    var {mime, bytes} = decode(dataURL(new UIImage({data: big})))
    assert.equal(mime, "image/png")
    assert.equal(bytes.length, big.length)
    assert.ok(Buffer.from(bytes).equals(Buffer.from(big)))
})

test("a data image does not read as a symbol", function() {
    page("<i id=\"icon\"></i><img id=\"photo\">")
    new UIImageView("#icon").image = new UIImage({systemName: "fas fa-x"})
    assert.ok(document.getElementById("icon").classList.contains("fas"))
    new UIImageView("#photo").image = new UIImage({data: bytesOf("gif89")})
    assert.equal(document.getElementById("photo").className, "")
})
