G = this;
GW = {};

/**
 * @class GW.Class
 * Base for all other classes in GW.
 *
 * __Defining a class:__
 *
 *     @example
 *     GW.define('Cat', {
 *       constructor: function(name) {
 *         this.name = name;
 *       },
 *
 *       meow: function() {
 *         print('Meow, meow, ' + this.name);
 *       }
 *     });
 *
 *     var cat = new Cat('Catty');
 *     cat.meow();
 *
 *
 * __Defining a subclass:__
 *
 *     @example
 *     GW.define('Animal', {
 *       go: function() {
 *         print('I go');
 *       }
 *     });
 *
 *     GW.define('Snail', 'Animal', {
 *       go: function() {
 *         Snail.parent.go.apply(this, arguments);
 *
 *         print('But rather slowly...');
 *       }
 *     });
 *
 *     var animal = new Snail();
 *     animal.go();
 *
 *
 * __Overriding parent class methods while defining a subclass:__
 *
 *     @example
 *     GW.define('Animal', {
 *       go: function() {
 *         print('I go');
 *       }
 *     });
 *
 *     GW.define('Snail', 'Animal', {
 *       'after:go': function() {
 *         print('But rather slowly...');
 *       }
 *     });
 *
 *     var animal = new Snail();
 *     animal.go();
 *
 *
 * __Overriding methods later using GW.override helper:__
 *
 *     @example
 *     GW.define('Boy', {
 *       say: function() {
 *         print('I am single!');
 *       }
 *     });
 *
 *     GW.override(Boy, {
 *       'before:say': function() {
 *         print('Wait for it...');
 *       },
 *       'after:say': function() {
 *         print('...yes, I am!');
 *       }
 *     });
 *
 *     var person = new Boy();
 *     person.say();
 *
 * __Overriding async methods using GW.override helper:__
 *
 *     @example
 *     GW.define('Boy', {
 *       say: function() {
 *         return GW.Defer.timeout(1000).done(function() {
 *           print('I am single!');
 *         });
 *       }
 *     });
 *
 *     GW.override(Boy, {
 *       'before:say': function() {
 *         print('Saying!');
 *       },
 *       'chain:say': function(defer) {
 *         return defer.done(function() {
 *           return GW.Defer.timeout(1000).done(function() {
 *             print('Yes, I am!');
 *             return GW.Defer.timeout(1000);
 *           });
 *         });
 *       }
 *     });
 *
 *     var person = new Boy();
 *     person.say().done(function() {
 *       print('All said!');
 *     });
 */
(function() {
	"use strict";

	/**
	 * @static
	 * @property {String} __className__
	 * Fully qualified name of the class (eg. GW.Component).
	 * This property will be set for any class that inherits from
	 * GW.Class.
	 */
	/**
	 * @static
	 * @property {GW.Class} __classParent__
	 * Reference to the parent of the class.
	 * This property will be set for any class that inherits from
	 * GW.Class.
	 */
	/**
	 * @static
	 * @property {Object} __classNameIndex__
	 * Mapping from fully qualified class names to class references.
	 */
	/**
	 * @static
	 * @property {GW.Class} parent
	 * Shorthand reference to `__classParent__.prototype`. You can used this
	 * to call overriden parent mehtods.
	 * This property will be set for any class that inherits from
	 * GW.Class.
	 */
	/**
	 * @static
	 * @method __override__
	 * Wrap method of this class.
	 * @param {String} name Name of the method.
	 * @param {Function} fn Wrapping function.
	 * This property will be set for any class that inherits from
	 * GW.Class.
	 */

	GW.Class = function() {};
	GW.Class.__className__ = 'GW.Class';
	GW.Class.__classParent__ = null;
	GW.Class.__classNameIndex__ = {};
	GW.Class.parent = null;

	/**
	 * @private
	 * @static
	 * Wrap class method by name.
	 * @param {GW.Class} cls Any class that inherits from GW.Class.
	 * @param {String} name Method name.
	 */
	GW.Class.__wrapClassMethod__ = function(cls, name, fn) {
		var wrapped;

		if (cls.prototype.hasOwnProperty(name)) {
			if (typeof cls.prototype[name] != 'function') {
				throw TypeError('Property ' + cls.__className__ + '.' + name + ' is not a function');
			}

			wrapped = cls.prototype[name];
		} else {
			wrapped = cls.prototype[name] = function() {
				if (cls.parent && typeof cls.parent[name] == 'function') {
					return cls.parent[name].apply(this, arguments);
				}
			};

			wrapped.displayName = cls.__className__ + '.' + name + '[chain]';
		}

		cls.prototype[name] = function() {
			var args = Array.from(arguments);
			args.unshift(wrapped.bind(this));
			return fn.apply(this, args);
		};

		cls.prototype[name].displayName = cls.__className__ + '.' + name + '[wrap]';
		fn.displayName = cls.__className__ + '.' + name + '[override]';
	};

	/**
	 * @private
	 * @static
	 * Wrap instance method by name.
	 * @param {GW.Class} inst Any instance of a class that inherits from GW.Class.
	 * @param {String} name Method name.
	 * @param {Function} fn Wrapping function.
	 */
	GW.Class.__wrapInstanceMethod__ = function(inst, name, fn) {
		var cls = inst.constructor, wrapped;

		// instance already has this property, just return it
		if (inst.hasOwnProperty(name)) {
			if (typeof inst[name] != 'function') {
				throw TypeError('Property ' + cls.__className__ + '.' + name + ' is not a function');
			}

			wrapped = inst[name];
		} else {
			wrapped = function() {
				if (typeof cls.prototype[name] == 'function') {
					return cls.prototype[name].apply(this, arguments);
				}
			};

			wrapped.displayName = cls.__className__ + '.' + name + '[chain]';
		}

		inst[name] = function() {
			var args = Array.from(arguments);
			args.unshift(wrapped.bind(this));
			return fn.apply(this, args);
		};

		inst[name].displayName = cls.__className__ + '.' + name + '[wrap,inst]';
		fn.displayName = cls.__className__ + '.' + name + '[override,inst]';
	};

	Object.assign(GW.Class.prototype, {
		/**
		 * @constructor
		 * Empty constructor.
		 */
		__classConstructor__: function() {
		},

		/**
		 * Check if object is of particular `class` or derived from one.
		 * @param {String} type Class name.
		 * @return {Boolean} True if this instance is of particular
		 * `class` or derived from one.
		 */
		isOfType: function(type) {
			var cls = GW.Class.__classNameIndex__[type];
			if (!cls) {
				return false;
			}

			return this instanceof cls;
		},

		/**
		 * Wrap method of this instance.
		 * @param {String} name Name of the method.
		 * @param {Function} fn Wrapping function.
		 */
		__override__: function(name, fn) {
			GW.Class.__wrapInstanceMethod__(this, name, fn);
		}
	});

	/**
	 * @private
	 * @static
	 * Define a new class.
	 * @param {String} name Name of the new class.
	 * @param {GW.Class} parent Parent class.
	 * @param {Object} props Class properties and methods.
	 * @return {GW.Class} New class derived from parent.
	 */
	GW.Class.define = function(name, parent, props) {
		var cls = function() {
			if (!this) {
				throw TypeError('Forgot new when constructing ' + name);
			}

			this.__classConstructor__.apply(this, arguments);
		};

		cls.displayName = name;
		cls.__className__ = name;
		cls.__classParent__ = parent;
		cls.prototype = Object.create(parent.prototype);
		cls.prototype.constructor = cls;
		cls.parent = parent.prototype; // for super calls
		cls.__override__ = function(name, fn) {
			GW.Class.__wrapClassMethod__(cls, name, fn);
		};

		// register class name
		if (!props.singleton) {
			GW.Class.__classNameIndex__[name] = cls;
		}

		if (props.hasOwnProperty('constructor')) {
			if (typeof props.constructor != 'function') {
				throw TypeError('Invalid constructor in ' + name);
			}

			props.constructor.displayName = name + '.constructor';
			cls.prototype.__classConstructor__ = props.constructor;

			delete props.constructor;
		}

		GW.override(cls, props);

		if (Array.isArray(props.overrides)) {
			props.overrides.forEach(function(override) {
				if (override instanceof Function) {
					override(cls);
				}
			});
		}

		return cls;
	};
})();

/**
 * @class GW
 * @singleton
 *
 * GW namespace contains several helper methods.
 *
 * __Playground:__
 *
 * Click "Code Editor" button and have fun.
 *
 *     @example
 *     GW.create({text: 'Hi', 'on:click': alert.bind(null, 'Hi!')}, 'button').render(document.body);
 */

/**
 * Define a new class.
 * @param {String} className Fully qualified class name.
 * @param {String} [parentClassName] Parent class name.
 * @param {Object} classDef Class properties and methods. It recognizes some
 * special properties:
 * @param {Boolean} classDef.singleton If true, a single instance from the new
 * class will be created and assigned to the property defined
 * by fully qualified class name.
 *
 * __Example:__
 *
 *     GW.define('App', {
 *       singleton: true,
 *       say: function() {
 *         print('I am single!');
 *       }
 *     });
 *
 *     App.say();
 *     // -> I am single!
 */
GW.define = function() {
	var args = Array.from(arguments);
	if (args.length < 2 || args.length > 3 || typeof args[0] != 'string') {
		throw new Error("Invalid call to GW.define, usage GW.define(name [,parent], props)");
	}

	var name = args.shift();
	var ns = G;
	var parts = name.split('.');
	var lastName = parts.shift();

	while (parts.length > 0) {
		if (!ns[lastName]) {
			ns[lastName] = {};
		} else if (!GW.isPlainObject(ns[lastName])) {
			throw new Error("Can't define class " + name + " because part of the namespace is not an object");
		}

		ns = ns[lastName];
		lastName = parts.shift();
	}

	// create class
	var props = args[args.length - 1];
	var parent = args.length == 2 ? args[0] : GW.Class;

	function resolveParent(p) {
		var cls = null;
		if (typeof p == 'string') {
			cls = GW.Class.__classNameIndex__[p];
			if (!cls) {
				throw new Error("Can't define " + name + " because parent class " + p + " is undefined");
			}

			return cls;
		} else if (GW.isPlainObject(p)) {
			if (p.__className__) {
				return p;
			}

			throw new Error("Can't define " + name + " because parent classes was not defined by GW.define");
		} else {
			throw new Error("Can't define " + name + " because parent class is invalid");
		}
	}

	if (props.singleton) {
		return ns[lastName] = new (GW.Class.define(name, resolveParent(parent), props))();
	}

	return ns[lastName] = GW.Class.define(name, resolveParent(parent), props);
};

/**
 * Override class or instance methods.
 * @param {Object} item Instance or class object to override.
 * @param {Object} spec Override specification object. Properties should be in
 * form:
 *
 * - `after:methodName`: function(...) {}
 * - `before:methodName`: function(...) {}
 * - `wrap:methodName`: function(origFn, ...) { return newRetval; }
 * - `intercept:methodName`: function(...) { return newRetval; }
 *    If you return something, intercepted method will not be called and returned
 *    value will be returned to the caller instead.
 * - `chain:methodName`: function(origRetval, ...) { return newRetval; }
 */
GW.override = (function() {
	var types = {
		after: function(fn) {
			return function(origFn) {
				var args = Array.from(arguments).slice(1);
				var retval = origFn.apply(this, args);
				fn.apply(this, args);
				return retval;
			};
		},

		before: function(fn) {
			return function(origFn) {
				var args = Array.from(arguments).slice(1);
				fn.apply(this, args);
				return origFn.apply(this, args);
			};
		},

		wrap: function(fn) {
			return fn;
		},

		intercept: function(fn) {
			return function(origFn) {
				var args = Array.from(arguments).slice(1);
				var retval = fn.apply(this, args);
				if (typeof retval != 'undefined') {
					return retval;
				}

				return origFn.apply(this, args);
			};
		},

		chain: function(fn) {
			return function(origFn) {
				var args = Array.from(arguments).slice(1);
				var retval = origFn.apply(this, args);
				return fn.apply(this, [retval].concat(args));
			};
		}
	};

	return function(target, spec) {
		var k, m, propertiesTarget, name;

		if (target instanceof GW.Class) {
			propertiesTarget = target;
			name = target.constructor.__className__;
		} else if (GW.isPlainObject(target) && target.__className__) {
			propertiesTarget = target.prototype;
			name = target.__className__;
		} else {
			throw TypeError('Invalid override target, must be GW defined class or instance');
		}

		for (k in spec) {
			if (spec.hasOwnProperty(k)) {
				if (typeof spec[k] == 'function') {
					spec[k].displayName = name + '.' + k;
				}

				m = k.match(/^([^:]+):(.+)$/);
				if (m && !(m[1] == 'on' || m[1] == 'on*')) {
					if (types[m[1]]) {
						target.__override__(m[2], types[m[1]](spec[k]));
					} else {
						throw new Error("Unknown override type " + m[1] + " in " + k);
					}
				} else {
					propertiesTarget[k] = spec[k];
				}
			}
		}

		return target;
	};
})();
