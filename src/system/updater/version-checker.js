'use strict';

const semver = require('semver');

/**
 * @param {string} current
 * @param {string} latest
 * @returns {{ hasUpdate: boolean; current: string; latest: string; isMajor?: boolean; diff?: semver.ReleaseType | null }}
 */
function compareVersions(current, latest) {
  const cleanCurrent = normalizeVersion(current);
  const cleanLatest = normalizeVersion(latest);

  if (!semver.valid(cleanCurrent)) {
    throw new Error(`Current version "${current}" is not valid semver`);
  }

  if (!semver.valid(cleanLatest)) {
    throw new Error(`Latest version "${latest}" is not valid semver`);
  }

  if (semver.gte(cleanCurrent, cleanLatest)) {
    return {
      hasUpdate: false,
      current: cleanCurrent,
      latest: cleanLatest,
    };
  }

  return {
    hasUpdate: true,
    current: cleanCurrent,
    latest: cleanLatest,
    isMajor: semver.major(cleanLatest) > semver.major(cleanCurrent),
    diff: semver.diff(cleanCurrent, cleanLatest),
  };
}

function normalizeVersion(version) {
  const normalized = String(version).trim().replace(/^v/iu, '');
  return semver.clean(normalized) || normalized;
}

module.exports = { compareVersions };
