import { enumeration } from "../utils/required.js"


// UIKit's UITextContentType, a string-backed struct, reduced to the cases a
// web page can honour: each has a WHATWG autocomplete token (see UITextField).
// Apple's cases with no token are left out and listed in the README.
export const UITextContentType = Object.freeze({
    oneTimeCode: "oneTimeCode",
    newPassword: "newPassword",
    password: "password",
    username: "username",
    emailAddress: "emailAddress",
    telephoneNumber: "telephoneNumber",
    name: "name",
    givenName: "givenName",
    familyName: "familyName",
    organizationName: "organizationName",
    postalCode: "postalCode",
    fullStreetAddress: "fullStreetAddress",
    addressCity: "addressCity",
    addressState: "addressState",
    countryName: "countryName",
    creditCardNumber: "creditCardNumber",
    URL: "URL",
})


// The WHATWG autocomplete token each case draws, and back.
const tokens = Object.freeze({
    oneTimeCode: "one-time-code",
    newPassword: "new-password",
    password: "current-password",
    username: "username",
    emailAddress: "email",
    telephoneNumber: "tel",
    name: "name",
    givenName: "given-name",
    familyName: "family-name",
    organizationName: "organization",
    postalCode: "postal-code",
    fullStreetAddress: "street-address",
    addressCity: "address-level2",
    addressState: "address-level1",
    countryName: "country-name",
    creditCardNumber: "cc-number",
    URL: "url",
})

export function autocompleteTokenOf(type) {
    return tokens[type]
}

// The case a token names, or null for a token no case names (such as off).
export function textContentTypeOf(token) {
    return Object.keys(tokens).find((name) => tokens[name] === token) || null
}

// The check the setters share.
// Its cases are listed as values: a case named `name` would otherwise be taken for a function's own property.
export const textContentTypeDescriptor = enumeration(Object.freeze(Object.values(UITextContentType)), "UITextContentType")
export const textContentTypeSignature = "Apple's is var textContentType: UITextContentType!; write field.textContentType = UITextContentType.password, or null for none."
