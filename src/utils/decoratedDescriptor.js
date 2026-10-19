// What IBOutlet and IBAction hand back to a legacy-decorator transform.
//
// Babel reads value, get, set and initializer off whatever a decorator
// returns, so returning the prototype (as these once did) runs any accessor of
// those names the class defines. Returning a field's own descriptor is no
// better: Babel would then install the field on the instance after the
// superclass constructor has bound the outlet, and fail redefining it. A field
// therefore gets a descriptor with no initializer, which Babel defines on the
// prototype and skips on the instance, as before; a method keeps its own.
export function decoratedDescriptor(descriptor) {
    if (descriptor && "value" in descriptor) { return descriptor }
    return {configurable: true, enumerable: true, writable: true}
}
