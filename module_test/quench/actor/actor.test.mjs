// basic.test.mjs
import test from 'node:test';
import {expect} from 'chai';

// Code under test (inline for simplicity)
function isEven(n) {
    return n % 2 === 0;
}

test('isEven returns true for even numbers', () => {
    expect(isEven(4)).to.equal(true);
});

test('isEven returns false for odd numbers', () => {
    expect(isEven(5)).to.equal(false);
});
