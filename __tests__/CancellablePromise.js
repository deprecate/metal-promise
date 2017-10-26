import CancellablePromise from '../src/CancellablePromise';
import sinon from 'sinon';
import { async, nullFunction } from 'metal';

let unhandledRejectionHandler = sinon.stub();

describe('CancellablePromise', function() {
	beforeAll(function() {
		CancellablePromise.setUnhandledRejectionHandler(unhandledRejectionHandler);
	});

	beforeEach(function() {
		unhandledRejectionHandler.reset();
	});

	describe('resolve', function() {
		test('promise should resolve', function(done) {
			new CancellablePromise(function(resolve, reject) {
				resolve('value');
			}).then(function(value) {
				expect(value).toBe('value');
				done();
			});
		});

		test('promise should resolve asynchronously', function(done) {
			new CancellablePromise(function(resolve, reject) {
				async.nextTick(function() {
					resolve('value');
				});
			}).then(function(value) {
				expect(value).toBe('value');
				done();
			});
		});

		test('promise should resolve with catch', function(done) {
			new CancellablePromise(function(resolve, reject) {
				async.nextTick(function() {
					resolve('value');
				});
			}).catch(function() {
				fail();
			}).then(function(value) {
				expect(value).toBe('value');
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('promise should resolve with another promise', function(done) {
			let resolveBlocker;
			let hasFulfilled = false;
			const blocker = new CancellablePromise(function(resolve, reject) {
				resolveBlocker = reject;
			});

			const promise = CancellablePromise.resolve(blocker);

			promise.then(function(value) {
				hasFulfilled = true;
				expect(value).toBe('value');
			}, function() {
				fail();
			});

			expect(hasFulfilled).toBe(false);
			resolveBlocker('value');

			promise.then(function() {
				expect(hasFulfilled).toBe(true);
			});
			promise.thenAlways(function() {
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('promise should resolve without calling constructor', function(done) {
			CancellablePromise.resolve().then(function() {
				return 'value1';
			}).then(function(value) {
				expect(value).toBe('value1');
				return 'value2';
			}).then(function(value) {
				expect(value).toBe('value2');
				done();
			});
		});

		test('multiple resolves should not throw error', function(done) {
			let timesCalled = 0;

			const promise = new CancellablePromise(function(resolve, reject) {
				resolve('foo');
				resolve('bar');
			});

			promise.then(function(value) {
				timesCalled++;
				expect(value).toBe('foo');
				expect(timesCalled).toBe(1);
				done();
			});
		});
	});

	describe('thenAlways', function() {
		test('thenAlways should work with promise.resolve', function(done) {
			let thenAlwaysCalled = false;

			CancellablePromise.resolve('value').thenAlways(function() {
				expect(arguments.length).toBe(0);
				thenAlwaysCalled = true;
			}).then(function(value) {
				expect(value).toBe('value');
				expect(thenAlwaysCalled).toBe(true);
				done();
			});
		});

		test('thenAlways should work with promise.reject', function(done) {
			let thenAlwaysCalled = false;

			CancellablePromise.reject('error').thenAlways(function() {
				expect(arguments.length).toBe(0);
				thenAlwaysCalled = true;
			}).then(function() {
				fail();
			}, function(value) {
				expect(value).toBe('error');
				expect(thenAlwaysCalled).toBe(true);
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('thenAlways should be callable multiple times', function(done) {
			const calls = [];

			CancellablePromise.resolve('value').then(function(value) {
				expect(value).toBe('value');
				calls.push(1);
				return value;
			}).thenAlways(function() {
				expect(arguments.length).toBe(0);
				calls.push(2);
				fail('thenAlways throw');
			}).then(function(value) {
				expect(value).toBe('value');
				calls.push(3);
			}).thenAlways(function() {
				expect(calls).toEqual([1, 2, 3]);
			}).thenAlways(function() {
				const rejection = unhandledRejectionHandler.getCall(0);
				expect(unhandledRejectionHandler.callCount).toBe(1);
				expect(rejection.args[0].message).toBe('thenAlways throw');
			}).thenAlways(function() {
				expect(calls.length).toBe(3);
				done();
			});
		});
	});

	describe('reject', function() {
		test('promise should catch rejection', function(done) {
			new CancellablePromise(function(resolve, reject) {
				reject('error');
				resolve();
			}).then(function() {
				fail();
			}).catch(function(error) {
				expect(error).toBe('error');
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('promise should call thenAlways after error is caught', function(done) {
			new CancellablePromise(function(resolve, reject) {
				async.nextTick(function() {
					reject('error');
				});
			}).catch(function(error) {
				expect(error).toBe('error');
			}).thenAlways(function() {
				done();
			});
		});

		test('promise should catch errors thrown after resolving', function(done) {
			new CancellablePromise(function(resolve, reject) {
				async.nextTick(function() {
					resolve();
				});
			}).then(function() {
				fail('Error in then');
			}).catch(function(error) {
				expect(error.message).toBe('Error in then');
				done();
			});
		});

		test('multiple rejects should not throw error', function(done) {
			let timesCalled = 0;

			const promise = new CancellablePromise(function(resolve, reject) {
				reject('foo');
				reject('bar');
			});

			promise.then(function() {
				fail();
			}, function(value) {
				timesCalled++;
				expect(value).toBe('foo');
				expect(timesCalled).toBe(1);
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('promise should resolve with rejected promise', function(done) {
			let rejectBlocker;
			let hasRejected = false;
			const blocker = new CancellablePromise(function(resolve, reject) {
				rejectBlocker = reject;
			});

			const promise = CancellablePromise.resolve(blocker);

			promise.then(function() {
				fail();
			}, function(value) {
				hasRejected = true;
				expect(value).toBe('error');
			});

			expect(hasRejected).toBe(false);
			rejectBlocker('error');

			promise.then(function() {
				expect(hasRejected).toBe(true);
			});
			promise.thenAlways(function() {
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});
	});

	describe('cancel', function() {
		test('promise should cancel', function(done) {
			new CancellablePromise(function(resolve, reject) {
				async.nextTick(function() {
					reject('non cancellation error');
				});
			}).catch(function(error) {
				expect(error.IS_CANCELLATION_ERROR).toBe(true);
				done();
			}).cancel();
		});

		test('promise should not continue after cancel', function(done) {
			const promise = CancellablePromise.resolve();
			promise.cancel();
			promise.then(null, function() {
				fail();
			});
			promise.thenAlways(function() {
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});

		test('promise should catch rejection error rather than cancellation error', function(done) {
			const promise = CancellablePromise.reject('error');
			promise.cancel();
			promise.then(function() {
				fail();
			}, function(error) {
				expect(unhandledRejectionHandler.callCount).toBe(0);
				expect(error).toBe('error');
				done();
			});
		});

		test('promise cancelling should propagate', function(done) {
			let cancelError;
			const promise = new CancellablePromise(nullFunction);

			const promise2 = promise.then(function() {
				fail();
			}, function(error) {
				cancelError = error;
				expect(error.IS_CANCELLATION_ERROR).toBe(true);
				expect(error.message).toBe('parent cancel message');
				return 'value';
			}).then(function(value) {
				expect(value).toBe('value');
			}, function() {
				fail();
			});

			const promise3 = promise.then(function() {
				fail();
			}, function(error) {
				expect(cancelError).toBe('parent cancel message');
				return null;
			});

			promise.cancel('parent cancel message');
			CancellablePromise.all([promise2, promise3]).thenAlways(function() {
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});
	});

	describe('all', function() {
		test('promise.all should work on empty array', function(done) {
			CancellablePromise.all([]).then(function(value) {
				expect(value).toEqual([]);
				done();
			});
		});

		test('promise.all should work on array of promises', function(done) {
			const array = [
				createPromise('a', 100),
				createPromise('b'),
				createPromise(0)
			];

			CancellablePromise.all(array).then(function(value) {
				expect(value).toEqual(['a', 'b', 0]);
				done();
			});
		});

		test('promise.all should work on array of thenables', function(done) {
			const array = [
				createThenable('a'),
				createThenable('b'),
				createThenable(0)
			];

			CancellablePromise.all(array).then(function(value) {
				expect(value).toEqual(['a', 'b', 0]);
				done();
			});
		});

		test('promise.all should work on non thenables', function(done) {
			const array = [
				createPromise('a', 100),
				'b',
				createThenable(0)
			];

			CancellablePromise.all(array).then(function(value) {
				expect(value).toEqual(['a', 'b', 0]);
				done();
			});
		});

		test('promise.all should catch rejected promise', function(done) {
			const array = [
				createPromise('a', 100),
				createRejectedPromise('rejected-b'),
				createPromise('c')
			];

			CancellablePromise.all(array).catch(function(error) {
				expect(error).toBe('rejected-b');
				done();
			});
		});

		test('promise.allSettled should work on empty array', function(done) {
			CancellablePromise.allSettled([]).then(function(value) {
				expect(value).toEqual([]);
				done();
			});
		});

		test('promise.allSettled should work on both resolved and rejected promises', function(done) {
			const array = [
				createPromise('a', 100),
				createRejectedPromise('b'),
				'c',
				createRejectedThenable('rejected-d'),
				createPromise('e')
			];

			CancellablePromise.allSettled(array).then(function(value) {
				expect(value).toEqual([
					{
						fulfilled: true,
						value: 'a'
					},
					{
						fulfilled: false,
						reason: 'b'
					},
					{
						fulfilled: true,
						value: 'c'
					},
					{
						fulfilled: true,
						value: undefined
					},
					{
						fulfilled: true,
						value: 'e'
					}
				]);
				done();
			});
		});
	});

	describe('firstFulfilled', function() {
		test('promise.firstFulfilled should resolve to undefined on empty array', function(done) {
			CancellablePromise.firstFulfilled([]).then(function(value) {
				expect(value).toBeUndefined();
				done();
			});
		});

		test('promise.firstFulfilled should resolve to first fulfilled promise', function(done) {
			const array = [
				createPromise('a', 40),
				createRejectedPromise('rejected-b', 30),
				createRejectedPromise('rejected-c', 10),
				createPromise('d', 20)
			];

			CancellablePromise.firstFulfilled(array).then(function(value) {
				expect(value).toBe('d');
				done();
			});
		});

		test('promise.firstFulfilled should work with non thenable', function(done) {
			const array = [
				createPromise('a', 40),
				createRejectedPromise('rejected-b', 30),
				createRejectedPromise('rejected-c', 10),
				'd'
			];

			CancellablePromise.firstFulfilled(array).then(function(value) {
				expect(value).toBe('d');
				done();
			});
		});

		test('promise.firstFulfilled should work when all promises are rejected', function(done) {
			const array = [
				createRejectedPromise('rejected-a', 20),
				createRejectedPromise('rejected-b', 30),
				createRejectedPromise('rejected-c', 10)
			];

			CancellablePromise.firstFulfilled(array).then(function() {
				fail();
			}, function(value) {
				expect(value).toEqual(['rejected-a', 'rejected-b', 'rejected-c']);
				expect(unhandledRejectionHandler.callCount).toBe(0);
				done();
			});
		});
	});
});

function fail(msg) {
	throw new Error(msg || 'Test failed. This assertion shouldn\'t have been reached.');
}

function createPromise(value, delay) {
	delay = delay || 10;
	return new CancellablePromise(function(resolve, reject) {
		setTimeout(function() {
			resolve(value);
		}, delay);
	});
}

function createRejectedPromise(value, delay) {
	delay = delay || 10;
	return new CancellablePromise(function(resolve, reject) {
		setTimeout(function() {
			reject(value);
		}, delay);
	});
}

function createRejectedThenable(value) {
	return CancellablePromise.resolve().then(function() {
		new Error(value);
	});
}

function createThenable(value) {
	return CancellablePromise.resolve().then(function() {
		return value;
	});
}
