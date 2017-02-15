import CancellablePromise from '../src/promise/Promise';

function fulfillSoon(value, delay) {
	return new CancellablePromise(function(resolve, reject) {
		window.setTimeout(function() {
			resolve(value);
		}, delay);
	});
}

function rejectSoon(reason, delay) {
	return new CancellablePromise(function(resolve, reject) {
		window.setTimeout(function() {
			reject(reason);
		}, delay);
	});
}

describe('CancellablePromise', function(done) {
	it('Should testThenIsFulfilled', function() {
		let spy = sinon.spy();
		let p = new CancellablePromise((resolve, reject) => {
			resolve('resolved');
		});
		p.then(spy);

		assert.notOk(spy.calledOnce, 'then() must return before callbacks are invoked.');

		p.then(function() {
			assert.ok(spy.calledWith('resolved'),
				'onFulfilled was not called with the expected value.');
			assert.ok(spy.calledOnce,
				'onFulfilled must be called exactly once.');
			done();
		});
	});

	it('Should testThenVoidIsFulfilled', function(done) {
		let spy = sinon.spy();
		let p = CancellablePromise.resolve('resolve');
		p.thenVoid(spy);

		assert.notOk(spy.calledOnce,
			'thenVoid() must return before callbacks are invoked.');

		p.then(function() {
			assert.ok(spy.withArgs('resolve').calledOnce);
			done();
		});
	});

	it('Should testThenIsRejected', function(done) {
		let spyFulfill = sinon.spy();
		let spyRejected = sinon.spy();
		let p = CancellablePromise.reject('rejected');
		p.then(spyFulfill, spyRejected);

		assert.strictEqual(0, spyFulfill.callCount,
			'onFulfilled should never be called.');

		p.then(spyFulfill, function() {
			assert.ok(spyRejected.withArgs('rejected').calledOnce);
			done();
		});
	});

	it('Should testThenVoidIsRejected', function(done) {
		let spyFulfill = sinon.spy();
		let spyRejected = sinon.spy();
		let p = CancellablePromise.reject('rejected');
		p.thenVoid(spyFulfill, spyRejected);

		assert.strictEqual(0, spyFulfill.callCount,
			'onFulfilled should never be called.');

		p.then(spyFulfill, function() {
			assert.ok(spyRejected.withArgs('rejected').calledOnce,
				'onRejected must be called exactly once.');
			done();
		});
	});

	it('Should testOptionalOnFulfilled', function(done) {
		let spyFulfill = sinon.spy();
		let spyRejected = sinon.spy();
		CancellablePromise.resolve('resolved')
			.then(null, null)
			.then(null, spyRejected)
			.then(function(value) {
				assert.strictEqual(0, spyRejected.callCount,
					'onRejected should never be called.');
				assert.strictEqual(value, 'resolved');
				done();
			});
	});

	it('Should testOptionalOnRejected', function(done) {
		let spyFulfill = sinon.spy();
		let spyRejected = sinon.spy();
		CancellablePromise.reject('reason')
			.then(null, null)
			.then(spyFulfill)
			.then(spyFulfill, function(value) {
				assert.strictEqual(0, spyFulfill.callCount,
					'onFulfilled should never be called.');
				assert.strictEqual(value, 'reason');
				done();
			});
	});

	it('Should testMultipleResolves', function(done) {
		let spyFulfill = sinon.spy();
		var resolvePromise;

		var p = new CancellablePromise(function(resolve, reject) {
			resolvePromise = resolve;
			resolve('foo');
			resolve('bar');
		});

		p.then(spyFulfill);
		p.then(function() {
			assert.ok(spyFulfill.calledOnce,
				'onFulfilled must be called exactly once.');
		});

		window.setTimeout(function() {
			resolvePromise('baz');
			assert.ok(spyFulfill.calledOnce);
			done();
		}, 10);
	});

	it('Should testMultipleRejects', function(done) {
		let spyRejected = sinon.spy();
		var rejectPromise;

		var p = new CancellablePromise(function(resolve, reject) {
			rejectPromise = reject;
			reject('foo');
			reject('bar');
		});

		p.then(null, spyRejected);
		p.then(null, function() {
			assert.ok(spyRejected.calledOnce,
				'onFulfilled must be called exactly once.');
		});

		window.setTimeout(function() {
			rejectPromise('baz');
			assert.ok(spyRejected.calledOnce);
			done();
		}, 10);
	});

	describe('All', function() {
		it('Should resolve AllWithEmptyList', function(done) {
			CancellablePromise.all([]).then(function(value) {
				assert.ok(value.length === 0);
				done();
			});
		});

		it('Should resolve All', function(done) {
			CancellablePromise.all(['a', 'b', 'c']).then(function(value) {
				assert.strictEqual('a', value[0]);
				assert.strictEqual('b', value[1]);
				assert.strictEqual('c', value[2]);
				done();
			});
		});

		it('Should All resolve with non-thenable', function(done) {
			var a = fulfillSoon('a', 40);
			var b = 'b';
			var c = fulfillSoon(true, 10);
			var d = fulfillSoon('d', 20);
			// Test a falsey value.
			var z = 0;

			CancellablePromise.all([a, b, c, d, z]).then(function(value) {
				assert.strictEqual('a', value[0]);
				assert.strictEqual('b', value[1]);
				assert.strictEqual(true, value[2]);
				assert.strictEqual('d', value[3]);
				assert.strictEqual(0, value[4]);
				done();
			});
		});

		it('Should All rejects', function(done) {
			var a = fulfillSoon('a', 40);
			var b = rejectSoon('rejected-b', 30);
			var c = fulfillSoon('c', 10);
			var d = fulfillSoon('d', 20);

			const fulfillCallback = sinon.stub();

			CancellablePromise.all([a, b, c, d])
				.then(
					fulfillCallback,
					function(reason) {
						assert.strictEqual('rejected-b', reason);
						return a;
					}
			).then(
				function(value) {
					assert.strictEqual('a', value,
						'Promise "a" should be fulfilled even though the all()' +
						'was rejected.');
					assert.strictEqual(0, fulfillCallback.callCount);
					done();
				}
			);
		});
	});
});