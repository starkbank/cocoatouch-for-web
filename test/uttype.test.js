import "./setup.js"
import test from "node:test"
import assert from "node:assert/strict"
import { UTType } from "../src/index.js"
import { identifierConforms, declaredTypes } from "../src/uniformtypeidentifiers/uttype.js"


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

test("plainText, html and rtf carry Apple's identifiers, extensions and MIME types and conform to item", function() {
    var table = [
        [UTType.plainText, "public.plain-text", "txt", "text/plain"],
        [UTType.html, "public.html", "html", "text/html"],
        [UTType.rtf, "public.rtf", "rtf", "text/rtf"],
    ]
    for (var [type, identifier, extension, mime] of table) {
        assert.equal(type.identifier, identifier)
        assert.equal(type.preferredFilenameExtension, extension, identifier)
        assert.equal(type.preferredMIMEType, mime, identifier)
        assert.equal(type.conforms({to: UTType.item}), true, identifier)
        assert.equal(type.conforms({to: new UTType({mimeType: "text/csv"})}), false, identifier)
        assert.equal(type.conforms({to: UTType.image}), false, identifier)
        assert.equal(type.conforms({to: UTType.pdf}), false, identifier)
    }
    assert.equal(UTType.plainText, UTType.plainText)
})

test("a filename extension finds the text types, and so does their MIME type", function() {
    var table = [
        ["txt", "public.plain-text", "text/plain"],
        ["TXT", "public.plain-text", "text/plain"],
        ["html", "public.html", "text/html"],
        ["htm", "public.html", "text/html"],
        [".htm", "public.html", "text/html"],
        ["rtf", "public.rtf", "text/rtf"],
    ]
    for (var [extension, identifier, mime] of table) {
        var type = new UTType({filenameExtension: extension})
        assert.equal(type.identifier, identifier, extension)
        assert.equal(type.preferredMIMEType, mime, extension)
    }
    assert.equal(new UTType({filenameExtension: "htm"}).preferredFilenameExtension, "html")
    for (var [, identifier, mime] of table) {
        assert.equal(new UTType({mimeType: mime}).identifier, identifier, mime)
    }
})

test("a text file's extension conforms to item and to no image or pdf", function() {
    assert.equal(new UTType({filenameExtension: "txt"}).conforms({to: UTType.image}), false)
    assert.equal(new UTType({filenameExtension: "txt"}).conforms({to: UTType.item}), true)
})

// Identifiers, extensions and MIME types as UniformTypeIdentifiers answers them
// on a Mac (UTType.gif.preferredFilenameExtension and the like), checked against
// the SDK's UTCoreTypes.h and a run of UTType itself.
const imageTypes = [
    ["gif", "com.compuserve.gif", ["gif"], "image/gif"],
    ["webP", "org.webmproject.webp", ["webp"], "image/webp"],
    ["bmp", "com.microsoft.bmp", ["bmp"], "image/bmp"],
    ["heic", "public.heic", ["heic"], "image/heic"],
    ["heif", "public.heif", ["heif"], "image/heif"],
    ["tiff", "public.tiff", ["tiff", "tif"], "image/tiff"],
    ["svg", "public.svg-image", ["svg"], "image/svg+xml"],
]

test("each image constant has Apple's identifier, preferred extension and MIME type, and conforms to image", function() {
    for (var [name, identifier, extensions, mime] of imageTypes) {
        var type = UTType[name]
        assert.ok(type instanceof UTType, name)
        assert.equal(type.identifier, identifier, name)
        assert.equal(type.preferredFilenameExtension, extensions[0], name)
        assert.equal(type.preferredMIMEType, mime, name)
        assert.equal(type.conforms({to: UTType.image}), true, name)
        assert.equal(type.conforms({to: UTType.item}), true, name)
        assert.equal(type.conforms({to: UTType.pdf}), false, name)
        assert.equal(type.conforms({to: UTType.folder}), false, name)
        assert.equal(UTType.image.conforms({to: type}), false, name)
        assert.equal(UTType[name], type, name)
    }
})

test("an image type is found by every extension it lists, in any case and with a leading dot", function() {
    for (var [name, identifier, extensions] of imageTypes) {
        for (var extension of extensions) {
            for (var spelling of [extension, extension.toUpperCase(), "." + extension]) {
                var type = new UTType({filenameExtension: spelling})
                assert.equal(type.identifier, identifier, spelling)
                assert.equal(type.conforms({to: UTType.image}), true, spelling)
            }
        }
    }
})

test("an image type is found by its MIME type", function() {
    for (var [name, identifier, , mime] of imageTypes) {
        assert.equal(new UTType({mimeType: mime}).identifier, identifier, mime)
        assert.equal(new UTType({mimeType: mime.toUpperCase()}).identifier, identifier, mime)
    }
})

test("heic and heif are siblings under a standard type, neither the other's subtype", function() {
    assert.equal(UTType.heic.conforms({to: UTType.heif}), false)
    assert.equal(UTType.heif.conforms({to: UTType.heic}), false)
    assert.equal(UTType.heic.conforms({to: UTType.image}), true)
    assert.equal(UTType.heif.conforms({to: UTType.image}), true)
})

// Apple names no UTType constant for AVIF, but the system declares public.avif,
// so UTType(filenameExtension: "avif") and UTType(mimeType: "image/avif") find
// it, and it conforms to public.image.
test("avif has no named constant, and is still found by extension and by MIME type as public.avif", function() {
    assert.equal(UTType.avif, undefined)
    for (var spelling of ["avif", "AVIF", ".avif"]) {
        var type = new UTType({filenameExtension: spelling})
        assert.equal(type.identifier, "public.avif", spelling)
        assert.equal(type.preferredFilenameExtension, "avif", spelling)
        assert.equal(type.preferredMIMEType, "image/avif", spelling)
    }
    for (var mime of ["image/avif", "IMAGE/AVIF"]) {
        assert.equal(new UTType({mimeType: mime}).identifier, "public.avif", mime)
    }
})

test("avif conforms to image and item, and not to pdf or png", function() {
    var type = new UTType({filenameExtension: "avif"})
    assert.equal(type.conforms({to: UTType.image}), true)
    assert.equal(type.conforms({to: UTType.item}), true)
    assert.equal(type.conforms({to: UTType.pdf}), false)
    assert.equal(type.conforms({to: UTType.png}), false)
    assert.equal(UTType.image.conforms({to: type}), false)
})

test("avifs, the image sequence, stays dynamic", function() {
    assert.equal(new UTType({filenameExtension: "avifs"}).identifier, "dyn.avifs")
})

// Identifiers, conformance, extensions and MIME types as UTType answers them on a
// Mac (UTType(filenameExtension:), UTType(mimeType:) and supertypes). Word,
// OpenDocument and Excel have no static member on Apple, so they are reached by
// extension or MIME type; zip, archive and spreadsheet have one. Apple's docx
// and xlsx conform to org.openxmlformats.openxml, not to the zip type.
const officeTypes = [
    ["doc", "com.microsoft.word.doc", "application/msword", ["public.composite-content", "public.content", "public.data", "public.item"]],
    ["docx", "org.openxmlformats.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["org.openxmlformats.openxml", "public.composite-content", "public.content", "public.data", "public.item"]],
    ["odt", "org.oasis-open.opendocument.text", "application/vnd.oasis.opendocument.text", ["org.oasis-open.opendocument", "public.composite-content", "public.content", "public.data", "public.item"]],
    ["xls", "com.microsoft.excel.xls", "application/vnd.ms-excel", ["public.spreadsheet", "public.composite-content", "public.content", "public.data", "public.item"]],
    ["xlsx", "org.openxmlformats.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["org.openxmlformats.openxml", "public.spreadsheet", "public.composite-content", "public.content", "public.data", "public.item"]],
    ["zip", "public.zip-archive", "application/zip", ["com.pkware.zip-archive", "public.archive", "public.data", "public.item"]],
]

test("each office and archive extension and MIME type maps to Apple's identifier and back", function() {
    for (var [extension, identifier, mime] of officeTypes) {
        for (var spelling of [extension, extension.toUpperCase(), "." + extension]) {
            var byExtension = new UTType({filenameExtension: spelling})
            assert.equal(byExtension.identifier, identifier, spelling)
            assert.equal(byExtension.preferredMIMEType, mime, spelling)
            assert.equal(byExtension.preferredFilenameExtension, extension, spelling)
        }
        var byMime = new UTType({mimeType: mime})
        assert.equal(byMime.identifier, identifier, mime)
        assert.equal(byMime.preferredFilenameExtension, extension, mime)
        assert.equal(new UTType({mimeType: mime.toUpperCase()}).identifier, identifier, mime)
    }
})

test("each office and archive type conforms to the types Apple says it does, and to no other of them", function() {
    var candidates = ["org.openxmlformats.openxml", "org.oasis-open.opendocument", "public.composite-content", "public.content", "public.spreadsheet", "public.archive", "com.pkware.zip-archive", "public.zip-archive", "public.data", "public.item", "public.image", "public.text", "public.folder"]
    for (var [, identifier, , supertypes] of officeTypes) {
        assert.equal(identifierConforms(identifier, identifier), true, identifier)
        for (var candidate of candidates) {
            if (candidate === identifier) { continue }
            assert.equal(identifierConforms(identifier, candidate), supertypes.includes(candidate), identifier + " to " + candidate)
        }
    }
})

test("zip, archive and spreadsheet are constants, and the others have none", function() {
    assert.equal(UTType.zip.identifier, "public.zip-archive")
    assert.equal(UTType.zip.preferredFilenameExtension, "zip")
    assert.equal(UTType.zip.preferredMIMEType, "application/zip")
    assert.equal(UTType.archive.identifier, "public.archive")
    assert.equal(UTType.spreadsheet.identifier, "public.spreadsheet")
    assert.equal(UTType.archive.preferredFilenameExtension, null)
    assert.equal(UTType.archive.preferredMIMEType, null)
    assert.equal(UTType.spreadsheet.preferredMIMEType, null)
    assert.equal(UTType.zip.conforms({to: UTType.archive}), true)
    assert.equal(UTType.zip.conforms({to: UTType.item}), true)
    assert.equal(UTType.archive.conforms({to: UTType.zip}), false)
    assert.equal(new UTType({filenameExtension: "xls"}).conforms({to: UTType.spreadsheet}), true)
    assert.equal(new UTType({filenameExtension: "xlsx"}).conforms({to: UTType.spreadsheet}), true)
    assert.equal(new UTType({filenameExtension: "docx"}).conforms({to: UTType.spreadsheet}), false)
    assert.equal(new UTType({filenameExtension: "docx"}).conforms({to: UTType.zip}), false)
    assert.equal(new UTType({filenameExtension: "zip"}).conforms({to: UTType.archive}), true)
    for (var name of ["doc", "docx", "odt", "xls", "xlsx", "word", "excel", "openDocumentText"]) { assert.equal(UTType[name], undefined, name) }
    assert.equal(UTType.zip, UTType.zip)
})

test("an office document is no image and no text, and a zip is no office document", function() {
    for (var extension of ["doc", "docx", "odt", "xls", "xlsx", "zip"]) {
        var type = new UTType({filenameExtension: extension})
        assert.equal(type.conforms({to: UTType.image}), false, extension)
        assert.equal(type.conforms({to: UTType.pdf}), false, extension)
    }
    assert.equal(new UTType({filenameExtension: "zip"}).conforms({to: new UTType({filenameExtension: "xlsx"})}), false)
})

test("the earlier image, pdf and csv types resolve as they did", function() {
    assert.equal(new UTType({filenameExtension: "jpg"}).identifier, "public.jpeg")
    assert.equal(new UTType({filenameExtension: "png"}).identifier, "public.png")
    assert.equal(new UTType({mimeType: "application/pdf"}).identifier, "com.adobe.pdf")
    assert.equal(new UTType({filenameExtension: "csv"}).identifier, "public.comma-separated-values-text")
    assert.equal(new UTType({filenameExtension: "pem"}).identifier, "dyn.pem")
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

test("every declared type walks up to public.item, and every parent it names is declared", function() {
    var table = declaredTypes()
    for (var identifier of Object.keys(table)) {
        assert.equal(identifierConforms(identifier, "public.item"), true, identifier)
        for (var parent of table[identifier].parents) {
            assert.ok(parent in table, `${identifier} names ${parent}, which is not declared`)
        }
    }
})

test("pdf, image, text and the office types conform to public.content, public.data and public.item, as the system declares", function() {
    var identifiers = [
        UTType.pdf.identifier, UTType.image.identifier, UTType.png.identifier, UTType.jpeg.identifier, UTType.heic.identifier,
        UTType.plainText.identifier, UTType.commaSeparatedText.identifier, UTType.html.identifier, UTType.rtf.identifier,
        "public.text", "com.microsoft.word.doc", "org.openxmlformats.wordprocessingml.document", "org.oasis-open.opendocument.text",
        "com.microsoft.excel.xls", "org.openxmlformats.spreadsheetml.sheet", UTType.spreadsheet.identifier,
    ]
    for (var identifier of identifiers) {
        for (var ancestor of ["public.content", "public.data", "public.item"]) {
            assert.equal(identifierConforms(identifier, ancestor), true, `${identifier} to ${ancestor}`)
        }
    }
})

test("an archive is data and no content, and a folder is an item and no data", function() {
    assert.equal(identifierConforms(UTType.archive.identifier, "public.data"), true)
    assert.equal(identifierConforms(UTType.zip.identifier, "public.content"), false)
    assert.equal(identifierConforms(UTType.folder.identifier, "public.item"), true)
    assert.equal(identifierConforms(UTType.folder.identifier, "public.data"), false)
})
