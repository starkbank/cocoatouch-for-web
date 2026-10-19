import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UTType } from "../src/index.js"


test("each constant has Apple's identifier, extension and MIME type", function() {
    var table = [
        [UTType.pdf, "com.adobe.pdf", "pdf", "application/pdf"],
        [UTType.png, "public.png", "png", "image/png"],
        [UTType.jpeg, "public.jpeg", "jpeg", "image/jpeg"],
        [UTType.commaSeparatedText, "public.comma-separated-values-text", "csv", "text/csv"],
        [UTType.image, "public.image", null, null],
        [UTType.item, "public.item", null, null],
        [UTType.folder, "public.folder", null, null],
    ]
    for (var [type, identifier, extension, mime] of table) {
        assert.ok(type instanceof UTType, identifier)
        assert.equal(type.identifier, identifier)
        assert.equal(type.preferredFilenameExtension, extension, identifier)
        assert.equal(type.preferredMIMEType, mime, identifier)
    }
    assert.equal(UTType.pdf, UTType.pdf)
})

test("conforms({to}) follows the hierarchy: png and jpeg are images, everything is an item, a folder is no image", function() {
    assert.equal(UTType.png.conforms({to: UTType.image}), true)
    assert.equal(UTType.jpeg.conforms({to: UTType.image}), true)
    assert.equal(UTType.image.conforms({to: UTType.image}), true)
    assert.equal(UTType.pdf.conforms({to: UTType.item}), true)
    assert.equal(UTType.folder.conforms({to: UTType.item}), true)
    assert.equal(UTType.image.conforms({to: UTType.png}), false)
    assert.equal(UTType.pdf.conforms({to: UTType.image}), false)
    assert.equal(UTType.folder.conforms({to: UTType.image}), false)
    assert.equal(UTType.item.conforms({to: UTType.pdf}), false)
})

test("conforms requires a UTType for its to label", function() {
    assert.throws(() => UTType.pdf.conforms({}), (error) => error instanceof TypeError && /conforms\(to:\)/.test(error.message))
    assert.throws(() => UTType.pdf.conforms({to: "com.adobe.pdf"}), TypeError)
    assert.throws(() => UTType.pdf.conforms(), TypeError)
})

test("UTType(filenameExtension:) finds a known type and makes a dynamic one for an unknown extension", function() {
    assert.equal(new UTType({filenameExtension: "pdf"}).identifier, "com.adobe.pdf")
    assert.equal(new UTType({filenameExtension: "PDF"}).identifier, "com.adobe.pdf")
    assert.equal(new UTType({filenameExtension: "jpg"}).identifier, "public.jpeg")
    assert.equal(new UTType({filenameExtension: "jpg"}).preferredFilenameExtension, "jpeg")
    assert.equal(new UTType({filenameExtension: ".csv"}).identifier, "public.comma-separated-values-text")
    var pem = new UTType({filenameExtension: "pem"})
    assert.match(pem.identifier, /^dyn\./)
    assert.equal(pem.preferredFilenameExtension, "pem")
    assert.equal(pem.preferredMIMEType, null)
    assert.equal(pem.conforms({to: UTType.item}), true)
    assert.equal(pem.conforms({to: UTType.image}), false)
})

test("UTType(mimeType:) finds a known type and makes a dynamic one for a well-formed unknown MIME type", function() {
    assert.equal(new UTType({mimeType: "application/pdf"}).identifier, "com.adobe.pdf")
    assert.equal(new UTType({mimeType: "IMAGE/PNG"}).identifier, "public.png")
    assert.equal(new UTType({mimeType: "text/csv"}).identifier, "public.comma-separated-values-text")
    var unknown = new UTType({mimeType: "Application/X-Unknown+json"})
    assert.equal(unknown.identifier, "dyn.application/x-unknown+json")
    assert.equal(unknown.preferredMIMEType, "application/x-unknown+json")
    assert.equal(unknown.preferredFilenameExtension, null)
    assert.equal(unknown.conforms({to: UTType.item}), true)
    assert.equal(unknown.conforms({to: UTType.image}), false)
    assert.equal(unknown.conforms({to: new UTType({mimeType: "application/x-unknown+json"})}), true)
})

test("UTType(mimeType:) refuses what is not type/subtype", function() {
    for (var malformed of ["", "pdf", "application/", "/pdf", "a/b/c", "application pdf", "application/pdf; charset=utf-8", 7, null, {}]) {
        assert.throws(() => new UTType({mimeType: malformed}), (error) => error instanceof TypeError && /UTType\(mimeType:\)/.test(error.message), String(malformed))
    }
})

test("a dynamic type from an extension and one from a MIME type are told apart", function() {
    var byExtension = new UTType({filenameExtension: "pem"})
    assert.equal(byExtension.preferredMIMEType, null)
    assert.equal(byExtension.preferredFilenameExtension, "pem")
    assert.throws(() => new UTType({filenameExtension: "a/b"}), TypeError)
})

test("a UTType takes exactly one of its labels", function() {
    assert.throws(() => new UTType(), TypeError)
    assert.throws(() => new UTType({}), TypeError)
    assert.throws(() => new UTType({filenameExtension: "pdf", mimeType: "application/pdf"}), TypeError)
    assert.throws(() => new UTType({filenameExtension: 7}), TypeError)
    assert.throws(() => new UTType({filenameExtension: ""}), TypeError)
})
