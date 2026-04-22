import { Device } from '../types';

type PostureInput = Pick<Device, 'managed' | 'disk_encrypted' | 'os'>;

export function scoreDevice(device: PostureInput): number {
  let score = 0;
  if (device.managed) score += 40;
  if (device.disk_encrypted) score += 40;

  // OS freshness heuristic
  const os = (device.os || '').toLowerCase();
  if (/macos 14|windows 11|ubuntu 22/.test(os)) {
    score += 20;
  } else if (/macos 13|windows 10|ubuntu 20/.test(os)) {
    score += 10;
  } else if (os.length > 0) {
    score += 5;
  }

  if (score > 100) score = 100;
  return score;
}

export function postureOk(device: PostureInput): boolean {
  return scoreDevice(device) >= 80;
}
