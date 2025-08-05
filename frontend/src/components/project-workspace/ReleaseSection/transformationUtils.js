/**
 * Utility functions for transformation parameters
 */

// Get the appropriate unit label for a parameter
export const getUnitLabel = (paramKey, paramDef) => {
  const unitMap = {
    brightness: "× (multiplier)",
    contrast: "× (multiplier)",
    rotation: "° (degrees)",
    scale: "% (percent)",
    blur: "px (pixels)",
    // Add more as needed
  };

  return unitMap[paramKey] || paramDef.unit || "";
};

// Format value for display
export const formatValue = (paramKey, val) => {
  // For brightness and contrast, show 0-100% range
  if (paramKey === 'brightness' || paramKey === 'contrast') {
    const uiVal = ((val - 0.5) * 100).toFixed(0);
    return `${uiVal}%`;
  }

  // For rotation, show degrees
  if (paramKey === 'rotation') {
    return `${val}°`;
  }

  // For scale, show as percentage
  if (paramKey === 'scale') {
    return `${val}%`;
  }

  // Default formatting
  return val.toFixed(2);
};