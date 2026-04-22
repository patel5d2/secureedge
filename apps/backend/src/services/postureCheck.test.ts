import { describe, it, expect } from 'vitest';
import { scoreDevice, postureOk } from './postureCheck';

describe('postureCheck', () => {
  describe('scoreDevice', () => {
    it('returns 100 for managed + encrypted + modern OS', () => {
      expect(scoreDevice({ managed: true, disk_encrypted: true, os: 'macOS 14' })).toBe(100);
    });

    it('returns 80 for managed + encrypted + older OS', () => {
      expect(scoreDevice({ managed: true, disk_encrypted: true, os: 'macOS 13' })).toBe(90);
    });

    it('returns 40 for managed only', () => {
      expect(scoreDevice({ managed: true, disk_encrypted: false, os: '' })).toBe(40);
    });

    it('returns 40 for encrypted only', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: true, os: '' })).toBe(40);
    });

    it('returns 0 for unmanaged + unencrypted + no OS', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: false, os: '' })).toBe(0);
    });

    it('gives 20 points for Windows 11', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: false, os: 'Windows 11 Pro' })).toBe(20);
    });

    it('gives 20 points for Ubuntu 22', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: false, os: 'Ubuntu 22.04' })).toBe(20);
    });

    it('gives 10 points for Windows 10', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: false, os: 'Windows 10' })).toBe(10);
    });

    it('gives 5 points for unknown OS with value', () => {
      expect(scoreDevice({ managed: false, disk_encrypted: false, os: 'ChromeOS' })).toBe(5);
    });

    it('caps at 100', () => {
      // managed(40) + encrypted(40) + modern OS(20) = 100
      expect(scoreDevice({ managed: true, disk_encrypted: true, os: 'Windows 11' })).toBe(100);
    });
  });

  describe('postureOk', () => {
    it('returns true when score >= 80', () => {
      expect(postureOk({ managed: true, disk_encrypted: true, os: 'macOS 14' })).toBe(true);
    });

    it('returns false when score < 80', () => {
      expect(postureOk({ managed: true, disk_encrypted: false, os: '' })).toBe(false);
    });

    it('returns true at exactly 80 (managed + encrypted + no OS = 80)', () => {
      expect(postureOk({ managed: true, disk_encrypted: true, os: '' })).toBe(true);
    });
  });
});
