/*!
 * Promises polyfill from Google's Closure Library.
 *
 *      Copyright 2013 The Closure Library Authors. All Rights Reserved.
 *
 * NOTE(eduardo): Promise support is not ready on all supported browsers,
 * therefore metal-promise is temporarily using Google's promises as polyfill.
 * It supports cancellable promises and has clean and fast implementation.
 */

'use strict';

import { isDef, isDefAndNotNull, isFunction, isObject } from 'metal';
import { async } from 'metal';
import FreeList from '../Freelist';

var nullFunction = function() {};

/**
 * Provides a more strict interface for Thenables in terms of
 * http://promisesaplus.com for interop with {@see CancellablePromise}.
 *
 * @interface
 * @extends {IThenable.<TYPE>}
 * @template TYPE
 */
var Thenable = function() {};

/**
 * Adds callbacks that will operate on the result of the Thenable, returning a
 * new child Promise.
 *
 * If the Thenable is fulfilled, the {@code onFulfilled} callback will be
 * invoked with the fulfillment value as argument, and the child Promise will
 * be fulfilled with the return value of the callback. If the callback throws
 * an exception, the child Promise will be rejected with the thrown value
 * instead.
 *
 * If the Thenable is rejected, the {@code onRejected} callback will be invoked
 * with the rejection reason as argument, and the child Promise will be rejected
 * with the return value of the callback or thrown value.
 *
 * @param {?(function(this:THIS, TYPE):
 *             (RESULT|IThenable.<RESULT>|Thenable))=} opt_onFulfilled A
 *     function that will be invoked with the fulfillment value if the Promise
 *     is fullfilled.
 * @param {?(function(*): *)=} opt_onRejected A function that will be invoked
 *     with the rejection reason if the Promise is rejected.
 * @param {THIS=} opt_context An optional context object that will be the
 *     execution context for the callbacks. By default, functions are executed
 *     with the default this.
 * @return {!CancellablePromise.<RESULT>} A new Promise that will receive the
 *     result of the fulfillment or rejection callback.
 * @template RESULT,THIS
 */
Thenable.prototype.then = function(
	opt_onFulfilled, opt_onRejected, opt_context) {};


/**
 * An expando property to indicate that an object implements
 * {@code Thenable}.
 *
 * {@see addImplementation}.
 *
 * @const
 */
Thenable.IMPLEMENTED_BY_PROP = '$goog_Thenable';


/**
 * Marks a given class (constructor) as an implementation of Thenable, so
 * that we can query that fact at runtime. The class must have already
 * implemented the interface.
 * Exports a 'then' method on the constructor prototype, so that the objects
 * also implement the extern {@see Thenable} interface for interop with
 * other Promise implementations.
 * @param {function(new:Thenable,...[?])} ctor The class constructor. The
 *     corresponding class must have already implemented the interface.
 */
Thenable.addImplementation = function(ctor) {
	ctor.prototype.then = ctor.prototype.then;
	ctor.prototype.$goog_Thenable = true;
};


/**
 * @param {*} object
 * @return {boolean} Whether a given instance implements {@code Thenable}.
 *     The class/superclass of the instance must call {@code addImplementation}.
 */
Thenable.isImplementedBy = function(object) {
	if (!object) {
		return false;
	}
	try {
		return !!object.$goog_Thenable;
	} catch (e) {
		// Property access seems to be forbidden.
		return false;
	}
};


/**
 * Like bind(), except that a 'this object' is not required. Useful when the
 * target function is already bound.
 *
 * Usage:
 * var g = partial(f, arg1, arg2);
 * g(arg3, arg4);
 *
 * @param {Function} fn A function to partially apply.
 * @param {...*} var_args Additional arguments that are partially applied to fn.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked as a method of.
 */
var partial = function(fn) {
	var args = Array.prototype.slice.call(arguments, 1);
	return function() {
		// Clone the array (with slice()) and append additional arguments
		// to the existing arguments.
		var newArgs = args.slice();
		newArgs.push.apply(newArgs, arguments);
		return fn.apply(this, newArgs);
	};
};

/**
 * NOTE: This class was created in anticipation of the built-in Promise type
 * being standardized and implemented across browsers. Now that Promise is
 * available in modern browsers, and is automatically polyfilled by the Closure
 * Compiler, by default, most new code should use native {@code Promise}
 * instead of {@code CancellablePromise}. However, {@code CancellablePromise} has the
 * concept of cancellation which native Promises do not yet have. So code
 * needing cancellation may still want to use {@code CancellablePromise}.
 *
 * Promises provide a result that may be resolved asynchronously. A Promise may
 * be resolved by being fulfilled with a fulfillment value, rejected with a
 * rejection reason, or blocked by another Promise. A Promise is said to be
 * settled if it is either fulfilled or rejected. Once settled, the Promise
 * result is immutable.
 *
 * Promises may represent results of any type, including undefined. Rejection
 * reasons are typically Errors, but may also be of any type. Closure Promises
 * allow for optional type annotations that enforce that fulfillment values are
 * of the appropriate types at compile time.
 *
 * The result of a Promise is accessible by calling {@code then} and registering
 * {@code onFulfilled} and {@code onRejected} callbacks. Once the Promise
 * is settled, the relevant callbacks are invoked with the fulfillment value or
 * rejection reason as argument. Callbacks are always invoked in the order they
 * were registered, even when additional {@code then} calls are made from inside
 * another callback. A callback is always run asynchronously sometime after the
 * scope containing the registering {@code then} invocation has returned.
 *
 * If a Promise is resolved with another Promise, the first Promise will block
 * until the second is settled, and then assumes the same result as the second
 * Promise. This allows Promises to depend on the results of other Promises,
 * linking together multiple asynchronous operations.
 *
 * This implementation is compatible with the Promises/A+ specification and
 * passes that specification's conformance test suite. A Closure Promise may be
 * resolved with a Promise instance (or sufficiently compatible Promise-like
 * object) created by other Promise implementations. From the specification,
 * Promise-like objects are known as "Thenables".
 *
 * @see http://promisesaplus.com/
 *
 * @param {function(
 *             this:RESOLVER_CONTEXT,
 *             function((TYPE|IThenable<TYPE>|Thenable)=),
 *             function(*=)): void} resolver
 *     Initialization function that is invoked immediately with {@code resolve}
 *     and {@code reject} functions as arguments. The Promise is resolved or
 *     rejected with the first argument passed to either function.
 * @param {RESOLVER_CONTEXT=} opt_context An optional context for executing the
 *     resolver function. If unspecified, the resolver function will be executed
 *     in the default scope.
 * @constructor
 * @struct
 * @final
 * @implements {Thenable<TYPE>}
 * @template TYPE,RESOLVER_CONTEXT
 */
var CancellablePromise = function(resolver, opt_context) {
	/**
	 * The internal state of this Promise. Either PENDING, FULFILLED, REJECTED, or
	 * BLOCKED.
	 * @private {CancellablePromise.State_}
	 */
	this.state_ = CancellablePromise.State_.PENDING;

	/**
	 * The settled result of the Promise. Immutable once set with either a
	 * fulfillment value or rejection reason.
	 * @private {*}
	 */
	this.result_ = undefined;

	/**
	 * For Promises created by calling {@code then()}, the originating parent.
	 * @private {CancellablePromise}
	 */
	this.parent_ = null;

	/**
	 * The linked list of {@code onFulfilled} and {@code onRejected} callbacks
	 * added to this Promise by calls to {@code then()}.
	 * @private {?CancellablePromise.CallbackEntry_}
	 */
	this.callbackEntries_ = null;

	/**
	 * The tail of the linked list of {@code onFulfilled} and {@code onRejected}
	 * callbacks added to this Promise by calls to {@code then()}.
	 * @private {?CancellablePromise.CallbackEntry_}
	 */
	this.callbackEntriesTail_ = null;

	/**
	 * Whether the Promise is in the queue of Promises to execute.
	 * @private {boolean}
	 */
	this.executing_ = false;

	if (CancellablePromise.UNHANDLED_REJECTION_DELAY > 0) {
		/**
		 * A timeout ID used when the {@code UNHANDLED_REJECTION_DELAY} is greater
		 * than 0 milliseconds. The ID is set when the Promise is rejected, and
		 * cleared only if an {@code onRejected} callback is invoked for the
		 * Promise (or one of its descendants) before the delay is exceeded.
		 *
		 * If the rejection is not handled before the timeout completes, the
		 * rejection reason is passed to the unhandled rejection handler.
		 * @private {number}
		 */
		this.unhandledRejectionId_ = 0;
	} else if (CancellablePromise.UNHANDLED_REJECTION_DELAY === 0) {
		/**
		 * When the {@code UNHANDLED_REJECTION_DELAY} is set to 0 milliseconds, a
		 * boolean that is set if the Promise is rejected, and reset to false if an
		 * {@code onRejected} callback is invoked for the Promise (or one of its
		 * descendants). If the rejection is not handled before the next timestep,
		 * the rejection reason is passed to the unhandled rejection handler.
		 * @private {boolean}
		 */
		this.hadUnhandledRejection_ = false;
	}

	// As an optimization, we can skip this if resolver is nullFunction.
	// This value is passed internally when creating a promise which will be
	// resolved through a more optimized path.
	if (resolver !== nullFunction) {
		try {
			var self = this;
			resolver.call(
				opt_context,
				function(value) {
					self.resolve_(CancellablePromise.State_.FULFILLED, value);
				},
				function(reason) {
					self.resolve_(CancellablePromise.State_.REJECTED, reason);
				});
		} catch (e) {
			this.resolve_(CancellablePromise.State_.REJECTED, e);
		}
	}
};


/**
 * The delay in milliseconds before a rejected Promise's reason
 * is passed to the rejection handler. By default, the rejection handler
 * rethrows the rejection reason so that it appears in the developer console or
 * {@code window.onerror} handler.
 *
 * Rejections are rethrown as quickly as possible by default. A negative value
 * disables rejection handling entirely.
 * @type {number}
 */
CancellablePromise.UNHANDLED_REJECTION_DELAY = 0;


/**
 * The possible internal states for a Promise. These states are not directly
 * observable to external callers.
 * @enum {number}
 * @private
 */
CancellablePromise.State_ = {
	/** The Promise is waiting for resolution. */
	PENDING: 0,

	/** The Promise is blocked waiting for the result of another Thenable. */
	BLOCKED: 1,

	/** The Promise has been resolved with a fulfillment value. */
	FULFILLED: 2,

	/** The Promise has been resolved with a rejection reason. */
	REJECTED: 3
};



/**
 * Entries in the callback chain. Each call to {@code then},
 * {@code thenCatch}, or {@code thenAlways} creates an entry containing the
 * functions that may be invoked once the Promise is settled.
 *
 * @private @final @struct @constructor
 */
CancellablePromise.CallbackEntry_ = function() {
	/** @type {?CancellablePromise} */
	this.child = null;
	/** @type {Function} */
	this.onFulfilled = null;
	/** @type {Function} */
	this.onRejected = null;
	/** @type {?} */
	this.context = null;
	/** @type {?CancellablePromise.CallbackEntry_} */
	this.next = null;

	/**
	 * A boolean value to indicate this is a "thenAlways" callback entry.
	 * Unlike a normal "then/thenVoid" a "thenAlways doesn't participate
	 * in "cancel" considerations but is simply an observer and requires
	 * special handling.
	 * @type {boolean}
	 */
	this.always = false;
};


/** clear the object prior to reuse */
CancellablePromise.CallbackEntry_.prototype.reset = function() {
	this.child = null;
	this.onFulfilled = null;
	this.onRejected = null;
	this.context = null;
	this.always = false;
};


/**
 * The number of currently unused objects to keep around for
 *    reuse.
 */
CancellablePromise.DEFAULT_MAX_UNUSED = 100;


/** @const @private {FreeList<!CancellablePromise.CallbackEntry_>} */
CancellablePromise.freelist_ = new FreeList(
	function() {
		return new CancellablePromise.CallbackEntry_();
	},
	function(item) {
		item.reset();
	}, CancellablePromise.DEFAULT_MAX_UNUSED);


/**
 * @param {Function} onFulfilled
 * @param {Function} onRejected
 * @param {?} context
 * @return {!CancellablePromise.CallbackEntry_}
 * @private
 */
CancellablePromise.getCallbackEntry_ = function(onFulfilled, onRejected, context) {
	var entry = CancellablePromise.freelist_.get();
	entry.onFulfilled = onFulfilled;
	entry.onRejected = onRejected;
	entry.context = context;
	return entry;
};


/**
 * @param {!CancellablePromise.CallbackEntry_} entry
 * @private
 */
CancellablePromise.returnEntry_ = function(entry) {
	CancellablePromise.freelist_.put(entry);
};


/**
 * @param {VALUE=} opt_value
 * @return {RESULT} A new Promise that is immediately resolved
 *     with the given value. If the input value is already a CancellablePromise, it
 *     will be returned immediately without creating a new instance.
 * @template VALUE
 * @template RESULT := type('CancellablePromise',
 *     cond(isUnknown(VALUE), unknown(),
 *       mapunion(VALUE, (V) =>
 *         cond(isTemplatized(V) && sub(rawTypeOf(V), 'IThenable'),
 *           templateTypeOf(V, 0),
 *           cond(sub(V, 'Thenable'),
 *              unknown(),
 *              V)))))
 * =:
 */
CancellablePromise.resolve = function(opt_value) {
	if (opt_value instanceof CancellablePromise) {
		// Avoid creating a new object if we already have a promise object
		// of the correct type.
		return opt_value;
	}

	// Passing nullFunction will cause the constructor to take an optimized
	// path that skips calling the resolver function.
	var promise = new CancellablePromise(nullFunction);
	promise.resolve_(CancellablePromise.State_.FULFILLED, opt_value);
	return promise;
};


/**
 * @param {*=} opt_reason
 * @return {!CancellablePromise} A new Promise that is immediately rejected with the
 *     given reason.
 */
CancellablePromise.reject = function(opt_reason) {
	return new CancellablePromise(function(resolve, reject) {
		reject(opt_reason);
	});
};


/**
 * This is identical to
 * {@code CancellablePromise.resolve(value).then(onFulfilled, onRejected)}, but it
 * avoids creating an unnecessary wrapper Promise when {@code value} is already
 * thenable.
 *
 * @param {?(Thenable<TYPE>|Thenable|TYPE)} value
 * @param {function(TYPE): ?} onFulfilled
 * @param {function(*): *} onRejected
 * @template TYPE
 * @private
 */
CancellablePromise.resolveThen_ = function(value, onFulfilled, onRejected) {
	var isThenable = CancellablePromise.maybeThen_(value, onFulfilled, onRejected, null);
	if (!isThenable) {
		async.run(partial(onFulfilled, value));
	}
};


/**
 * @param {!Array<?(CancellablePromise<TYPE>|Thenable<TYPE>|Thenable|*)>}
 *     promises
 * @return {!CancellablePromise<TYPE>} A Promise that receives the result of the
 *     first Promise (or Promise-like) input to settle immediately after it
 *     settles.
 * @template TYPE
 */
CancellablePromise.race = function(promises) {
	return new CancellablePromise(function(resolve, reject) {
		if (!promises.length) {
			resolve(undefined);
		}
		for (var i = 0, promise; i < promises.length; i++) {
			promise = promises[i];
			CancellablePromise.resolveThen_(promise, resolve, reject);
		}
	});
};


/**
 * @param {!Array<?(CancellablePromise<TYPE>|Thenable<TYPE>|Thenable|*)>}
 *     promises
 * @return {!CancellablePromise<!Array<TYPE>>} A Promise that receives a list of
 *     every fulfilled value once every input Promise (or Promise-like) is
 *     successfully fulfilled, or is rejected with the first rejection reason
 *     immediately after it is rejected.
 * @template TYPE
 */
CancellablePromise.all = function(promises) {
	return new CancellablePromise(function(resolve, reject) {
		var toFulfill = promises.length;
		var values = [];

		if (!toFulfill) {
			resolve(values);
			return;
		}

		var onFulfill = function(index, value) {
			toFulfill--;
			values[index] = value;
			if (toFulfill === 0) {
				resolve(values);
			}
		};

		var onReject = function(reason) {
			reject(reason);
		};

		for (var i = 0, promise; i < promises.length; i++) {
			promise = promises[i];
			CancellablePromise.resolveThen_(promise, partial(onFulfill, i), onReject);
		}
	});
};


/**
 * @param {!Array<?(CancellablePromise<TYPE>|Thenable<TYPE>|Thenable|*)>}
 *     promises
 * @return {!CancellablePromise<!Array<{
 *     fulfilled: boolean,
 *     value: (TYPE|undefined),
 *     reason: (*|undefined)}>>} A Promise that resolves with a list of
 *         result objects once all input Promises (or Promise-like) have
 *         settled. Each result object contains a 'fulfilled' boolean indicating
 *         whether an input Promise was fulfilled or rejected. For fulfilled
 *         Promises, the resulting value is stored in the 'value' field. For
 *         rejected Promises, the rejection reason is stored in the 'reason'
 *         field.
 * @template TYPE
 */
CancellablePromise.allSettled = function(promises) {
	return new CancellablePromise(function(resolve, reject) {
		var toSettle = promises.length;
		var results = [];

		if (!toSettle) {
			resolve(results);
			return;
		}

		var onSettled = function(index, fulfilled, result) {
			toSettle--;
			results[index] = fulfilled ? {
				fulfilled: true,
				value: result
			} :
				{
					fulfilled: false,
					reason: result
				};
			if (toSettle === 0) {
				resolve(results);
			}
		};

		for (var i = 0, promise; i < promises.length; i++) {
			promise = promises[i];
			CancellablePromise.resolveThen_(
				promise, partial(onSettled, i, true /* fulfilled */ ),
				partial(onSettled, i, false /* fulfilled */ ));
		}
	});
};


/**
 * @param {!Array<?(CancellablePromise<TYPE>|Thenable<TYPE>|Thenable|*)>}
 *     promises
 * @return {!CancellablePromise<TYPE>} A Promise that receives the value of the first
 *     input to be fulfilled, or is rejected with a list of every rejection
 *     reason if all inputs are rejected.
 * @template TYPE
 */
CancellablePromise.firstFulfilled = function(promises) {
	return new CancellablePromise(function(resolve, reject) {
		var toReject = promises.length;
		var reasons = [];

		if (!toReject) {
			resolve(undefined);
			return;
		}

		var onFulfill = function(value) {
			resolve(value);
		};

		var onReject = function(index, reason) {
			toReject--;
			reasons[index] = reason;
			if (toReject === 0) {
				reject(reasons);
			}
		};

		for (var i = 0, promise; i < promises.length; i++) {
			promise = promises[i];
			CancellablePromise.resolveThen_(promise, onFulfill, partial(onReject, i));
		}
	});
};


/**
 * @return {!CancellablePromise.Resolver<TYPE>} Resolver wrapping the promise and its
 *     resolve / reject functions. Resolving or rejecting the resolver
 *     resolves or rejects the promise.
 * @template TYPE
 */
CancellablePromise.withResolver = function() {
	var resolve, reject;
	var promise = new CancellablePromise(function(rs, rj) {
		resolve = rs;
		reject = rj;
	});
	return new CancellablePromise.Resolver_(promise, resolve, reject);
};


/**
 * Adds callbacks that will operate on the result of the Promise, returning a
 * new child Promise.
 *
 * If the Promise is fulfilled, the {@code onFulfilled} callback will be invoked
 * with the fulfillment value as argument, and the child Promise will be
 * fulfilled with the return value of the callback. If the callback throws an
 * exception, the child Promise will be rejected with the thrown value instead.
 *
 * If the Promise is rejected, the {@code onRejected} callback will be invoked
 * with the rejection reason as argument, and the child Promise will be resolved
 * with the return value or rejected with the thrown value of the callback.
 *
 * @override
 */
CancellablePromise.prototype.then = function(
	opt_onFulfilled, opt_onRejected, opt_context) {

	if (isDefAndNotNull(opt_onFulfilled)) {
		if (!isFunction(opt_onFulfilled)) {
			throw new Error('opt_onFulfilled should be a function.');
		}
	}
	if (isDefAndNotNull(opt_onRejected)) {
		if (!isFunction(opt_onRejected)) {
			throw new Error(
				'opt_onRejected should be a function. Did you pass opt_context ' +
				'as the second argument instead of the third?');
		}
	}

	return this.addChildPromise_(
		isFunction(opt_onFulfilled) ? opt_onFulfilled : null,
		isFunction(opt_onRejected) ? opt_onRejected : null, opt_context);
};
Thenable.addImplementation(CancellablePromise);


/**
 * Adds callbacks that will operate on the result of the Promise without
 * returning a child Promise (unlike "then").
 *
 * If the Promise is fulfilled, the {@code onFulfilled} callback will be invoked
 * with the fulfillment value as argument.
 *
 * If the Promise is rejected, the {@code onRejected} callback will be invoked
 * with the rejection reason as argument.
 *
 * @param {?(function(this:THIS, TYPE):?)=} opt_onFulfilled A
 *     function that will be invoked with the fulfillment value if the Promise
 *     is fulfilled.
 * @param {?(function(this:THIS, *): *)=} opt_onRejected A function that will
 *     be invoked with the rejection reason if the Promise is rejected.
 * @param {THIS=} opt_context An optional context object that will be the
 *     execution context for the callbacks. By default, functions are executed
 *     with the default this.
 * @package
 * @template THIS
 */
CancellablePromise.prototype.thenVoid = function(
	opt_onFulfilled, opt_onRejected, opt_context) {

	if (isDefAndNotNull(opt_onFulfilled)) {
		if (!isFunction(opt_onFulfilled)) {
			throw new Error('opt_onFulfilled should be a function.');
		}
	}
	if (isDefAndNotNull(opt_onRejected)) {
		if (!isFunction(opt_onRejected)) {
			throw new Error(
				'opt_onRejected should be a function. Did you pass opt_context ' +
				'as the second argument instead of the third?');
		}
	}

	// Note: no default rejection handler is provided here as we need to
	// distinguish unhandled rejections.
	this.addCallbackEntry_(
		CancellablePromise.getCallbackEntry_(
			opt_onFulfilled || nullFunction, opt_onRejected || null,
			opt_context));
};


/**
 * Adds a callback that will be invoked when the Promise is settled (fulfilled
 * or rejected). The callback receives no argument, and no new child Promise is
 * created. This is useful for ensuring that cleanup takes place after certain
 * asynchronous operations. Callbacks added with {@code thenAlways} will be
 * executed in the same order with other calls to {@code then},
 * {@code thenAlways}, or {@code thenCatch}.
 *
 * Since it does not produce a new child Promise, cancellation propagation is
 * not prevented by adding callbacks with {@code thenAlways}. A Promise that has
 * a cleanup handler added with {@code thenAlways} will be canceled if all of
 * its children created by {@code then} (or {@code thenCatch}) are canceled.
 * Additionally, since any rejections are not passed to the callback, it does
 * not stop the unhandled rejection handler from running.
 *
 * @param {function(this:THIS): void} onSettled A function that will be invoked
 *     when the Promise is settled (fulfilled or rejected).
 * @param {THIS=} opt_context An optional context object that will be the
 *     execution context for the callbacks. By default, functions are executed
 *     in the global scope.
 * @return {!CancellablePromise<TYPE>} This Promise, for chaining additional calls.
 * @template THIS
 */
CancellablePromise.prototype.thenAlways = function(onSettled, opt_context) {
	var entry = CancellablePromise.getCallbackEntry_(onSettled, onSettled, opt_context);
	entry.always = true;
	this.addCallbackEntry_(entry);
	return this;
};


/**
 * Adds a callback that will be invoked only if the Promise is rejected. This
 * is equivalent to {@code then(null, onRejected)}.
 *
 * @param {function(this:THIS, *): *} onRejected A function that will be
 *     invoked with the rejection reason if the Promise is rejected.
 * @param {THIS=} opt_context An optional context object that will be the
 *     execution context for the callbacks. By default, functions are executed
 *     in the global scope.
 * @return {!CancellablePromise} A new Promise that will receive the result of the
 *     callback.
 * @template THIS
 */
CancellablePromise.prototype.thenCatch = function(onRejected, opt_context) {
	return this.addChildPromise_(null, onRejected, opt_context);
};


/**
 * Alias of {@link CancellablePromise.prototype.thenCatch}
 */
CancellablePromise.prototype.catch = CancellablePromise.prototype.thenCatch;


/**
 * Cancels the Promise if it is still pending by rejecting it with a cancel
 * Error. No action is performed if the Promise is already resolved.
 *
 * All child Promises of the canceled Promise will be rejected with the same
 * cancel error, as with normal Promise rejection. If the Promise to be canceled
 * is the only child of a pending Promise, the parent Promise will also be
 * canceled. Cancellation may propagate upward through multiple generations.
 *
 * @param {string=} opt_message An optional debugging message for describing the
 *     cancellation reason.
 */
CancellablePromise.prototype.cancel = function(opt_message) {
	if (this.state_ === CancellablePromise.State_.PENDING) {
		async.run(function() {
			var err = new CancellablePromise.CancellationError(opt_message);
			err.IS_CANCELLATION_ERROR = true;
			this.cancelInternal_(err);
		}, this);
	}
};


/**
 * Cancels this Promise with the given error.
 *
 * @param {!Error} err The cancellation error.
 * @private
 */
CancellablePromise.prototype.cancelInternal_ = function(err) {
	if (this.state_ === CancellablePromise.State_.PENDING) {
		if (this.parent_) {
			// Cancel the Promise and remove it from the parent's child list.
			this.parent_.cancelChild_(this, err);
			this.parent_ = null;
		} else {
			this.resolve_(CancellablePromise.State_.REJECTED, err);
		}
	}
};


/**
 * Cancels a child Promise from the list of callback entries. If the Promise has
 * not already been resolved, reject it with a cancel error. If there are no
 * other children in the list of callback entries, propagate the cancellation
 * by canceling this Promise as well.
 *
 * @param {!CancellablePromise} childPromise The Promise to cancel.
 * @param {!Error} err The cancel error to use for rejecting the Promise.
 * @private
 */
CancellablePromise.prototype.cancelChild_ = function(childPromise, err) {
	if (!this.callbackEntries_) {
		return;
	}
	var childCount = 0;
	var childEntry = null;
	var beforeChildEntry = null;

	// Find the callback entry for the childPromise, and count whether there are
	// additional child Promises.
	for (var entry = this.callbackEntries_; entry; entry = entry.next) {
		if (!entry.always) {
			childCount++;
			if (entry.child === childPromise) {
				childEntry = entry;
			}
			if (childEntry && childCount > 1) {
				break;
			}
		}
		if (!childEntry) {
			beforeChildEntry = entry;
		}
	}

	// Can a child entry be missing?

	// If the child Promise was the only child, cancel this Promise as well.
	// Otherwise, reject only the child Promise with the cancel error.
	if (childEntry) {
		if (this.state_ === CancellablePromise.State_.PENDING && childCount === 1) {
			this.cancelInternal_(err);
		} else {
			if (beforeChildEntry) {
				this.removeEntryAfter_(beforeChildEntry);
			} else {
				this.popEntry_();
			}

			this.executeCallback_(childEntry, CancellablePromise.State_.REJECTED, err);
		}
	}
};


/**
 * Adds a callback entry to the current Promise, and schedules callback
 * execution if the Promise has already been settled.
 *
 * @param {CancellablePromise.CallbackEntry_} callbackEntry Record containing
 *     {@code onFulfilled} and {@code onRejected} callbacks to execute after
 *     the Promise is settled.
 * @private
 */
CancellablePromise.prototype.addCallbackEntry_ = function(callbackEntry) {
	if (!this.hasEntry_() && (this.state_ === CancellablePromise.State_.FULFILLED ||
		this.state_ === CancellablePromise.State_.REJECTED)) {
		this.scheduleCallbacks_();
	}
	this.queueEntry_(callbackEntry);
};


/**
 * Creates a child Promise and adds it to the callback entry list. The result of
 * the child Promise is determined by the state of the parent Promise and the
 * result of the {@code onFulfilled} or {@code onRejected} callbacks as
 * specified in the Promise resolution procedure.
 *
 * @see http://promisesaplus.com/#the__method
 *
 * @param {?function(this:THIS, TYPE):
 *          (RESULT|CancellablePromise<RESULT>|Thenable)} onFulfilled A callback that
 *     will be invoked if the Promise is fulfilled, or null.
 * @param {?function(this:THIS, *): *} onRejected A callback that will be
 *     invoked if the Promise is rejected, or null.
 * @param {THIS=} opt_context An optional execution context for the callbacks.
 *     in the default calling context.
 * @return {!CancellablePromise} The child Promise.
 * @template RESULT,THIS
 * @private
 */
CancellablePromise.prototype.addChildPromise_ = function(
	onFulfilled, onRejected, opt_context) {

	var callbackEntry = CancellablePromise.getCallbackEntry_(null, null, null);

	callbackEntry.child = new CancellablePromise(function(resolve, reject) {
		// Invoke onFulfilled, or resolve with the parent's value if absent.
		callbackEntry.onFulfilled = onFulfilled ? function(value) {
			try {
				var result = onFulfilled.call(opt_context, value);
				resolve(result);
			} catch (err) {
				reject(err);
			}
		} : resolve;

		// Invoke onRejected, or reject with the parent's reason if absent.
		callbackEntry.onRejected = onRejected ? function(reason) {
			try {
				var result = onRejected.call(opt_context, reason);
				if (!isDef(result) && reason.IS_CANCELLATION_ERROR) {
					// Propagate cancellation to children if no other result is returned.
					reject(reason);
				} else {
					resolve(result);
				}
			} catch (err) {
				reject(err);
			}
		} : reject;
	});

	callbackEntry.child.parent_ = this;
	this.addCallbackEntry_(callbackEntry);
	return callbackEntry.child;
};


/**
 * Unblocks the Promise and fulfills it with the given value.
 *
 * @param {TYPE} value
 * @private
 */
CancellablePromise.prototype.unblockAndFulfill_ = function(value) {
	if (this.state_ !== CancellablePromise.State_.BLOCKED) {
		throw new Error('state_ should be block');
	}
	this.state_ = CancellablePromise.State_.PENDING;
	this.resolve_(CancellablePromise.State_.FULFILLED, value);
};


/**
 * Unblocks the Promise and rejects it with the given rejection reason.
 *
 * @param {*} reason
 * @private
 */
CancellablePromise.prototype.unblockAndReject_ = function(reason) {
	if (this.state_ !== CancellablePromise.State_.BLOCKED) {
		throw new Error('state_ should be block');
	}
	this.state_ = CancellablePromise.State_.PENDING;
	this.resolve_(CancellablePromise.State_.REJECTED, reason);
};


/**
 * Attempts to resolve a Promise with a given resolution state and value. This
 * is a no-op if the given Promise has already been resolved.
 *
 * If the given result is a Thenable (such as another Promise), the Promise will
 * be settled with the same state and result as the Thenable once it is itself
 * settled.
 *
 * If the given result is not a Thenable, the Promise will be settled (fulfilled
 * or rejected) with that result based on the given state.
 *
 * @see http://promisesaplus.com/#the_promise_resolution_procedure
 *
 * @param {CancellablePromise.State_} state
 * @param {*} x The result to apply to the Promise.
 * @private
 */
CancellablePromise.prototype.resolve_ = function(state, x) {
	if (this.state_ !== CancellablePromise.State_.PENDING) {
		return;
	}

	if (this === x) {
		state = CancellablePromise.State_.REJECTED;
		x = new TypeError('Promise cannot resolve to itself');
	}

	this.state_ = CancellablePromise.State_.BLOCKED;
	var isThenable = CancellablePromise.maybeThen_(
		x, this.unblockAndFulfill_, this.unblockAndReject_, this);
	if (isThenable) {
		return;
	}

	this.result_ = x;
	this.state_ = state;
	// Since we can no longer be canceled, remove link to parent, so that the
	// child promise does not keep the parent promise alive.
	this.parent_ = null;
	this.scheduleCallbacks_();

	if (state === CancellablePromise.State_.REJECTED && !x.IS_CANCELLATION_ERROR) {
		CancellablePromise.addUnhandledRejection_(this, x);
	}
};


/**
 * Invokes the "then" method of an input value if that value is a Thenable. This
 * is a no-op if the value is not thenable.
 *
 * @param {?} value A potentially thenable value.
 * @param {!Function} onFulfilled
 * @param {!Function} onRejected
 * @param {?} context
 * @return {boolean} Whether the input value was thenable.
 * @private
 */
CancellablePromise.maybeThen_ = function(value, onFulfilled, onRejected, context) {
	if (value instanceof CancellablePromise) {
		value.thenVoid(onFulfilled, onRejected, context);
		return true;
	} else if (Thenable.isImplementedBy(value)) {
		value = /** @type {!Thenable} */ (value);
		value.then(onFulfilled, onRejected, context);
		return true;
	} else if (isObject(value)) {
		try {
			var then = value.then;
			if (isFunction(then)) {
				CancellablePromise.tryThen_(value, then, onFulfilled, onRejected, context);
				return true;
			}
		} catch (e) {
			onRejected.call(context, e);
			return true;
		}
	}

	return false;
};


/**
 * Attempts to call the {@code then} method on an object in the hopes that it is
 * a Promise-compatible instance. This allows interoperation between different
 * Promise implementations, however a non-compliant object may cause a Promise
 * to hang indefinitely. If the {@code then} method throws an exception, the
 * dependent Promise will be rejected with the thrown value.
 *
 * @see http://promisesaplus.com/#point-70
 *
 * @param {Thenable} thenable An object with a {@code then} method that may be
 *     compatible with the Promise/A+ specification.
 * @param {!Function} then The {@code then} method of the Thenable object.
 * @param {!Function} onFulfilled
 * @param {!Function} onRejected
 * @param {*} context
 * @private
 */
CancellablePromise.tryThen_ = function(
	thenable, then, onFulfilled, onRejected, context) {

	var called = false;
	var resolve = function(value) {
		if (!called) {
			called = true;
			onFulfilled.call(context, value);
		}
	};

	var reject = function(reason) {
		if (!called) {
			called = true;
			onRejected.call(context, reason);
		}
	};

	try {
		then.call(thenable, resolve, reject);
	} catch (e) {
		reject(e);
	}
};


/**
 * Executes the pending callbacks of a settled Promise after a timeout.
 *
 * Section 2.2.4 of the Promises/A+ specification requires that Promise
 * callbacks must only be invoked from a call stack that only contains Promise
 * implementation code, which we accomplish by invoking callback execution after
 * a timeout. If {@code startExecution_} is called multiple times for the same
 * Promise, the callback chain will be evaluated only once. Additional callbacks
 * may be added during the evaluation phase, and will be executed in the same
 * event loop.
 *
 * All Promises added to the waiting list during the same browser event loop
 * will be executed in one batch to avoid using a separate timeout per Promise.
 *
 * @private
 */
CancellablePromise.prototype.scheduleCallbacks_ = function() {
	if (!this.executing_) {
		this.executing_ = true;
		async.run(this.executeCallbacks_, this);
	}
};


/**
 * @return {boolean} Whether there are any pending callbacks queued.
 * @private
 */
CancellablePromise.prototype.hasEntry_ = function() {
	return !!this.callbackEntries_;
};


/**
 * @param {CancellablePromise.CallbackEntry_} entry
 * @private
 */
CancellablePromise.prototype.queueEntry_ = function(entry) {
	if (entry.onFulfilled === null) {
		throw new Error('onFulfilled should not be null');
	}

	if (this.callbackEntriesTail_) {
		this.callbackEntriesTail_.next = entry;
		this.callbackEntriesTail_ = entry;
	} else {
		// It the work queue was empty set the head too.
		this.callbackEntries_ = entry;
		this.callbackEntriesTail_ = entry;
	}
};


/**
 * @return {CancellablePromise.CallbackEntry_} entry
 * @private
 */
CancellablePromise.prototype.popEntry_ = function() {
	var entry = null;
	if (this.callbackEntries_) {
		entry = this.callbackEntries_;
		this.callbackEntries_ = entry.next;
		entry.next = null;
	}
	// It the work queue is empty clear the tail too.
	if (!this.callbackEntries_) {
		this.callbackEntriesTail_ = null;
	}

	if (entry !== null) {
		if (entry.onFulfilled === null) {
			throw new Error('onFulfilled should be defined.');
		}
	}
	return entry;
};


/**
 * @param {CancellablePromise.CallbackEntry_} previous
 * @private
 */
CancellablePromise.prototype.removeEntryAfter_ = function(previous) {
	if (!this.callbackEntries_) {
		throw new Error('callbackEntries_ should be defined.');
	}
	if (previous === null) {
		throw new Error('previous can not be null.');
	}
	// If the last entry is being removed, update the tail
	if (previous.next === this.callbackEntriesTail_) {
		this.callbackEntriesTail_ = previous;
	}

	previous.next = previous.next.next;
};


/**
 * Executes all pending callbacks for this Promise.
 *
 * @private
 */
CancellablePromise.prototype.executeCallbacks_ = function() {
	var entry = null;
	while (entry = this.popEntry_()) {
		this.executeCallback_(entry, this.state_, this.result_);
	}
	this.executing_ = false;
};


/**
 * Executes a pending callback for this Promise. Invokes an {@code onFulfilled}
 * or {@code onRejected} callback based on the settled state of the Promise.
 *
 * @param {!CancellablePromise.CallbackEntry_} callbackEntry An entry containing the
 *     onFulfilled and/or onRejected callbacks for this step.
 * @param {CancellablePromise.State_} state The resolution status of the Promise,
 *     either FULFILLED or REJECTED.
 * @param {*} result The settled result of the Promise.
 * @private
 */
CancellablePromise.prototype.executeCallback_ = function(
	callbackEntry, state, result) {
	// Cancel an unhandled rejection if the then/thenVoid call had an onRejected.
	if (state === CancellablePromise.State_.REJECTED && callbackEntry.onRejected &&
		!callbackEntry.always) {
		this.removeUnhandledRejection_();
	}

	if (callbackEntry.child) {
		// When the parent is settled, the child no longer needs to hold on to it,
		// as the parent can no longer be canceled.
		callbackEntry.child.parent_ = null;
		CancellablePromise.invokeCallback_(callbackEntry, state, result);
	} else {
		// Callbacks created with thenAlways or thenVoid do not have the rejection
		// handling code normally set up in the child Promise.
		try {
			callbackEntry.always ?
				callbackEntry.onFulfilled.call(callbackEntry.context) :
				CancellablePromise.invokeCallback_(callbackEntry, state, result);
		} catch (err) {
			CancellablePromise.handleRejection_.call(null, err);
		}
	}
	CancellablePromise.returnEntry_(callbackEntry);
};


/**
 * Executes the onFulfilled or onRejected callback for a callbackEntry.
 *
 * @param {!CancellablePromise.CallbackEntry_} callbackEntry
 * @param {CancellablePromise.State_} state
 * @param {*} result
 * @private
 */
CancellablePromise.invokeCallback_ = function(callbackEntry, state, result) {
	if (state === CancellablePromise.State_.FULFILLED) {
		callbackEntry.onFulfilled.call(callbackEntry.context, result);
	} else if (callbackEntry.onRejected) {
		callbackEntry.onRejected.call(callbackEntry.context, result);
	}
};


/**
 * Marks this rejected Promise as having being handled. Also marks any parent
 * Promises in the rejected state as handled. The rejection handler will no
 * longer be invoked for this Promise (if it has not been called already).
 *
 * @private
 */
CancellablePromise.prototype.removeUnhandledRejection_ = function() {
	if (CancellablePromise.UNHANDLED_REJECTION_DELAY > 0) {
		for (let p = this; p && p.unhandledRejectionId_; p = p.parent_) {
			clearTimeout(p.unhandledRejectionId_);
			p.unhandledRejectionId_ = 0;
		}
	} else if (CancellablePromise.UNHANDLED_REJECTION_DELAY === 0) {
		for (let p = this; p && p.hadUnhandledRejection_; p = p.parent_) {
			p.hadUnhandledRejection_ = false;
		}
	}
};


/**
 * Marks this rejected Promise as unhandled. If no {@code onRejected} callback
 * is called for this Promise before the {@code UNHANDLED_REJECTION_DELAY}
 * expires, the reason will be passed to the unhandled rejection handler. The
 * handler typically rethrows the rejection reason so that it becomes visible in
 * the developer console.
 *
 * @param {!CancellablePromise} promise The rejected Promise.
 * @param {*} reason The Promise rejection reason.
 * @private
 */
CancellablePromise.addUnhandledRejection_ = function(promise, reason) {
	if (CancellablePromise.UNHANDLED_REJECTION_DELAY > 0) {
		promise.unhandledRejectionId_ = setTimeout(function() {
			CancellablePromise.handleRejection_.call(null, reason);
		}, CancellablePromise.UNHANDLED_REJECTION_DELAY);

	} else if (CancellablePromise.UNHANDLED_REJECTION_DELAY === 0) {
		promise.hadUnhandledRejection_ = true;
		async.run(function() {
			if (promise.hadUnhandledRejection_) {
				CancellablePromise.handleRejection_.call(null, reason);
			}
		});
	}
};


/**
 * A method that is invoked with the rejection reasons for Promises that are
 * rejected but have no {@code onRejected} callbacks registered yet.
 * @type {function(*)}
 * @private
 */
CancellablePromise.handleRejection_ = async.throwException;


/**
 * Sets a handler that will be called with reasons from unhandled rejected
 * Promises. If the rejected Promise (or one of its descendants) has an
 * {@code onRejected} callback registered, the rejection will be considered
 * handled, and the rejection handler will not be called.
 *
 * By default, unhandled rejections are rethrown so that the error may be
 * captured by the developer console or a {@code window.onerror} handler.
 *
 * @param {function(*)} handler A function that will be called with reasons from
 *     rejected Promises. Defaults to {@code async.throwException}.
 */
CancellablePromise.setUnhandledRejectionHandler = function(handler) {
	CancellablePromise.handleRejection_ = handler;
};



/**
 * Error used as a rejection reason for canceled Promises.
 *
 * @param {string=} opt_message
 * @constructor
 * @extends {Error}
 * @final
 */
CancellablePromise.CancellationError = class extends Error {
	constructor(opt_message) {
		super(opt_message);

		if (opt_message) {
			this.message = opt_message;
		}
	}
}
;

/** @override */
CancellablePromise.CancellationError.prototype.name = 'cancel';



/**
 * Internal implementation of the resolver interface.
 *
 * @param {!CancellablePromise<TYPE>} promise
 * @param {function((TYPE|CancellablePromise<TYPE>|Thenable)=)} resolve
 * @param {function(*=): void} reject
 * @implements {CancellablePromise.Resolver<TYPE>}
 * @final @struct
 * @constructor
 * @private
 * @template TYPE
 */
CancellablePromise.Resolver_ = function(promise, resolve, reject) {
	/** @const */
	this.promise = promise;

	/** @const */
	this.resolve = resolve;

	/** @const */
	this.reject = reject;
};

if (typeof window.Promise === 'undefined') {
	window.Promise = CancellablePromise;
}

export { CancellablePromise };
export default CancellablePromise;
