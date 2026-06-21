'use strict';

const { normalizeVersion } = require('../github-client');

describe('normalizeVersion', () => {
  it('strips lowercase and uppercase release tag prefixes', () => {
    expect(normalizeVersion('v6.0.2')).toBe('6.0.2');
    expect(normalizeVersion('V6.0.2')).toBe('6.0.2');
  });
});
