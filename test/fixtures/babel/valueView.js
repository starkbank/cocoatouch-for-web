// Compiled from valueView.source.js by compile.mjs; do not edit.
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var _dec, _dec2, _dec3, _dec4, _class, _descriptor, _descriptor2, _descriptor3;
function _initializerDefineProperty(e, i, r, l) { r && Object.defineProperty(e, i, { enumerable: r.enumerable, configurable: r.configurable, writable: r.writable, value: r.initializer ? r.initializer.call(l) : void 0 }); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == _typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _applyDecoratedDescriptor(i, e, r, n, l) { var a = {}; return Object.keys(n).forEach(function (i) { a[i] = n[i]; }), a.enumerable = !!a.enumerable, a.configurable = !!a.configurable, ("value" in a || a.initializer) && (a.writable = !0), a = r.slice().reverse().reduce(function (r, n) { return n(i, e, r) || r; }, a), l && void 0 !== a.initializer && (a.value = a.initializer ? a.initializer.call(l) : void 0, a.initializer = void 0), void 0 === a.initializer ? (Object.defineProperty(i, e, a), null) : a; }
function _initializerWarningHelper(r, e) { throw Error("Decorating class property failed. Please ensure that transform-class-properties is enabled and runs after the decorators transform."); }
// The source of valueView.js, compiled by the legacy-decorator Babel setup the
// apps use (@babel/preset-env with modules: false, plugin-proposal-decorators
// {legacy: true}, plugin-proposal-class-properties). The compiled file is the
// fixture, so the framework suite needs no Babel; to regenerate it, run
// test/fixtures/babel/compile.mjs from a checkout that has those packages.
import { UIView, UIButton, IBOutlet, IBAction } from "../../../src/index.js";
export var reads = [];
export var ValueView = (_dec = IBOutlet("#label", UIView), _dec2 = IBOutlet(".item", [UIView]), _dec3 = IBOutlet("#seeded", UIView), _dec4 = IBAction("#go", UIButton), _class = /*#__PURE__*/function (_UIView) {
  function ValueView() {
    var _this;
    _classCallCheck(this, ValueView);
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    _this = _callSuper(this, ValueView, [].concat(args));
    _initializerDefineProperty(_this, "label", _descriptor, _this);
    _initializerDefineProperty(_this, "items", _descriptor2, _this);
    _initializerDefineProperty(_this, "seeded", _descriptor3, _this);
    return _this;
  }
  _inherits(ValueView, _UIView);
  return _createClass(ValueView, [{
    key: "tapped",
    value: function tapped() {
      return "tapped";
    }
  }, {
    key: "value",
    get: function get() {
      reads.push(this === ValueView.prototype ? "value:prototype" : "value:instance");
      return "value";
    }
  }, {
    key: "get",
    get: function get() {
      reads.push(this === ValueView.prototype ? "get:prototype" : "get:instance");
      return "get";
    }
  }, {
    key: "initializer",
    get: function get() {
      reads.push(this === ValueView.prototype ? "initializer:prototype" : "initializer:instance");
      return "initializer";
    }
  }, {
    key: "set",
    set: function set(value) {
      reads.push(this === ValueView.prototype ? "set:prototype" : "set:instance");
    }
  }]);
}(UIView), _descriptor = _applyDecoratedDescriptor(_class.prototype, "label", [_dec], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: null
}), _descriptor2 = _applyDecoratedDescriptor(_class.prototype, "items", [_dec2], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: null
}), _descriptor3 = _applyDecoratedDescriptor(_class.prototype, "seeded", [_dec3], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: function initializer() {
    return "initial";
  }
}), _applyDecoratedDescriptor(_class.prototype, "tapped", [_dec4], Object.getOwnPropertyDescriptor(_class.prototype, "tapped"), _class.prototype), _class);
ValueView.nib = "<span id=\"label\"></span><i class=\"item\"></i><i class=\"item\"></i><b id=\"seeded\"></b><button id=\"go\"></button>";
