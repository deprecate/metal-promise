import ProgressPromise from '../src/ProgressPromise';
import sinon from 'sinon';
import { async } from 'metal';

describe('ProgressPromise', function() {
	test('promise should update progress', function(done) {
		const listener = sinon.stub();

		new ProgressPromise(function(resolve, reject, progress) {
			progress(0.1);
			progress(0.2);
			progress(0.3);
			progress(0.4);
			progress(0.5);
			progress(0.6);
			progress(0.7);
			progress(0.8);
			progress(0.9);
			progress(1);
			resolve();
		})
		.progress(listener)
		.then(function() {
			expect(listener.callCount).toBe(9);
			expect(listener.getCall(0).args[0]).toBe(0.1);
			expect(listener.getCall(1).args[0]).toBe(0.2);
			expect(listener.getCall(2).args[0]).toBe(0.3);
			expect(listener.getCall(3).args[0]).toBe(0.4);
			expect(listener.getCall(4).args[0]).toBe(0.5);
			expect(listener.getCall(5).args[0]).toBe(0.6);
			expect(listener.getCall(6).args[0]).toBe(0.7);
			expect(listener.getCall(7).args[0]).toBe(0.8);
			expect(listener.getCall(8).args[0]).toBe(0.9);

			done();
		});
	});

	test('promise should throw error if progress isn\'t between 0 and 1', function(done) {
		const promise = new ProgressPromise(function() {});

		try {
			promise.setProgress_(1.1);
		} catch (e) {
			expect(e.message).toBe('The progress percentage should be a number between 0 and 1');

			done();
		}
	});

	test('promise should throw error if new progress percentage is lower than previous percentage', function(done) {
		const promise = new ProgressPromise(function(resolve, reject, progress) {
			progress(0.2);
		});

		async.nextTick(function() {
			try {
				promise.setProgress_(0.1);
			} catch (e) {
				expect(e.message).toBe('The progress percentage can\'t be lower than the previous percentage');

				done();
			}
		});
	});

	test('promise should not call listener if the same value is passed twice', function(done) {
		const listener = sinon.stub();

		const promise = new ProgressPromise(function(resolve, reject, progress) {
			async.nextTick(() => {
				progress(0.5);
				progress(0.5);
				resolve();
			});
		})
		.progress(listener)
		.then(() => {
			expect(listener.callCount).toBe(1);
			expect(listener.getCall(0).args[0]).toBe(0.5);

			done();
		})
	});

	test('promise should call all progress listeners when progress changes', function(done) {
		const listener = sinon.stub();

		const promise = new ProgressPromise(function(resolve, reject, progress) {
			async.nextTick(() => {
				progress(0.5);
				progress(0.75);
				resolve();
			});
		})
		.progress(listener)
		.progress(listener)
		.then(() => {
			expect(listener.callCount).toBe(4);
			expect(listener.getCall(0).args[0]).toBe(0.5);
			expect(listener.getCall(1).args[0]).toBe(0.5);
			expect(listener.getCall(2).args[0]).toBe(0.75);
			expect(listener.getCall(3).args[0]).toBe(0.75);

			done();
		})
	});
});
