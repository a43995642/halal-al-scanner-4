
// Utility for Haptic Feedback
const isHapticsEnabled = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('halalScannerHaptics') !== 'false';
  }
  return true;
};

export const vibrate = (pattern: number | number[] = 10) => {
  if (!isHapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};
