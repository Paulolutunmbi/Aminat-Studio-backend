const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('./artworkController');

test('featured limit helper is available and returns a clear validation message', () => {
  assert.ok(typeof controller.getFeaturedLimitError === 'function');
  const error = controller.getFeaturedLimitError({
    id: 'abc',
    featured: true,
    featuredCount: 3,
  });
  assert.match(error, /Only 3 artworks can be featured at a time/i);
});
