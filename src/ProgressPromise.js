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
	 * Invokes any listeners that have been attached via the progress` method.
	 */
	callProgressListeners_() {
		const progress = this.progress_;

		if (this.listeners_.length) {
			this.listeners_.forEach(listener => {
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
		this.callProgressListeners_();
	}
}

export default ProgressPromise;
