const sixDigits = /^#[0-9a-fA-F]{6}$/
const hexForm = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const functionForm = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*(\d*\.?\d+)(%?)\s*)?\)$/


// Whether a text is exactly `#rrggbb`, the one form a color input holds.
export function isSixDigitHex(text) {
    return typeof text === "string" && sixDigits.test(text)
}

// The red, green and blue (0 to 255) and the alpha (0 to 1) of a concrete css
// color written as hex, rgb()/rgba() or `transparent`; null for anything else,
// such as a var() that was never resolved.
export function colorComponents(cssValue) {
    if (typeof cssValue !== "string") { return null }
    var text = cssValue.trim()
    if (text === "transparent") { return {red: 0, green: 0, blue: 0, alpha: 0} }
    var hex = hexForm.exec(text)
    if (hex) { return _fromHex(hex[1]) }
    var parts = functionForm.exec(text)
    if (!parts) { return null }
    var alpha = parts[4] === undefined ? 1 : Number(parts[4]) / (parts[5] === "%" ? 100 : 1)
    return {red: Math.round(Number(parts[1])), green: Math.round(Number(parts[2])), blue: Math.round(Number(parts[3])), alpha: Math.min(Math.max(alpha, 0), 1)}
}

// `#rrggbb`, lower case, from components in 0 to 255.
export function sixDigitHex({red, green, blue}) {
    return "#" + [red, green, blue].map((part) => Math.min(Math.max(Math.round(part), 0), 255).toString(16).padStart(2, "0")).join("")
}

function _fromHex(digits) {
    var full = digits.length <= 4 ? digits.split("").map((digit) => digit + digit).join("") : digits
    var alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    return {red: parseInt(full.slice(0, 2), 16), green: parseInt(full.slice(2, 4), 16), blue: parseInt(full.slice(4, 6), 16), alpha: alpha}
}
