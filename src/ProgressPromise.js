'use strict';

import CancellablePromise from './promise/Promise';
import { async } from 'metal';

class ProgressPromise extends CancellablePromise {
	/**
	 * Creates a CancellablePromise that can track progress.
	 * @extends CancellablePromise
	 * @constructor
	 */
	constructor(resolver, opt_context) {
		const progressFn = progress => {
			async.nextTick(() => {
				this.setProgress_(progress);
			});
		};

		const resolverFn = (resolve, reject) => {
			resolver(resolve, reject, progressFn);
		};

		super(resolverFn, opt_context);

		this.listeners_ = [];
		this.progress_ = 0;
	}

	/**
	 * Overwrites `CancellablePromise.prototype.addChildPromise_` so that it
	 * implements another `ProgressPromise` as a child.
	 * @inheritdoc
	 */
	addChildPromise_(onFulfilled, onRejected, opt_context) {
		var callbackEntry = {
			child: null,
			onFulfilled: null,
			onRejected: null
		};

		callbackEntry.child = new ProgressPromise(function(resolve, reject) {
			callbackEntry.onFulfilled = onFulfilled ? function(value) {
				try {
					var result = onFulfilled.call(opt_context, value);
					resolve(result);
				} catch (err) {
					reject(err);
				}
			} : resolve;

			callbackEntry.onRejected = onRejected ? function(reason) {
				try {
					var result = onRejected.call(opt_context, reason);
					if (!isDef(result) && reason.IS_CANCELLATION_ERROR) {
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
	}

	/**
	 * Invokes any listeners that have been attached to child promises.
	 * @param {!number} progress A percentage between 0 and 1
	 */
	callChildProgressListeners_(progress) {
		if (this.callbackEntries_ && this.callbackEntries_.length) {
			this.callbackEntries_.forEach(callback => {
				this.callProgressListeners_(progress, callback.child.listeners_);
			});
		}
	}

	/**
	 * Invokes any listeners that have been attached via the `progress` method.
	 * @param {!number} progress A percentage between 0 and 1
	 * @param {!Array} listeners Array of listeners
	 */
	callProgressListeners_(progress, listeners) {
		if (listeners.length) {
			listeners.forEach(listener => {
				listener(progress);
			});
		}
	}

	/**
	 * Returns the current progress of the promise instance.
	 * Progress will be a number between 0 and 1.
	 * @return {number}
	 */
	getProgress() {
		return this.progress_;
	}

	/**
	 * Adds a listener that will be called once the progress has been updated.
	 * @param {!Function} listener
	 */
	progress(listener) {
		this.listeners_.push(listener);

		return this;
	}

	/**
	 * Updates the current progress of the promise and calls all listeners.
	 * @param {number} progress
	 */
	setProgress_(progress) {
		if (progress > 1 || progress < 0) {
			throw new TypeError('The progress percentage should be a number between 0 and 1');
		} else if (progress < this.progress_) {
			throw new Error('The progress percentage can\'t be lower than the previous percentage');
		} else if (progress === this.progress_ || progress === 1) {
			return;
		}

		this.progress_ = progress;

		this.callProgressListeners_(progress, this.listeners_);
		this.callChildProgressListeners_(progress);
	}
}

export default ProgressPromise;
