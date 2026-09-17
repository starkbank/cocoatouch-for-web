

export class NSString {

    static cleanScript(text) {
        if (text) {
            return text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
        }
        return ""
    }
}