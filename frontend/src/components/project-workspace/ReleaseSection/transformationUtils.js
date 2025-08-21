import { logInfo } from '../../../utils/professional_logger';

/**
 * Utility functions for transformation parameters
 */

// Get the appropriate unit label for a parameter
export const getUnitLabel = (paramKey, paramDef) => {
  logInfo('app.frontend.ui', 'get_unit_label_called', 'getUnitLabel utility function called', {
    timestamp: new Date().toISOString(),
    paramKey: paramKey,
    paramDef: paramDef,
    function: 'getUnitLabel'
  });

  const unitMap = {
    brightness: "× (multiplier)",
    contrast: "× (multiplier)",
    rotation: "° (degrees)",
    scale: "% (percent)",
    blur: "px (pixels)",
    // Add more as needed
  };

  const result = unitMap[paramKey] || paramDef.unit || "";
  
  logInfo('app.frontend.ui', 'get_unit_label_result', 'getUnitLabel result returned', {
    timestamp: new Date().toISOString(),
    paramKey: paramKey,
    result: result,
    function: 'getUnitLabel'
  });

  return result;
};

// Format value for display
export const formatValue = (paramKey, val) => {
  logInfo('app.frontend.ui', 'format_value_called', 'formatValue utility function called', {
    timestamp: new Date().toISOString(),
    paramKey: paramKey,
    value: val,
    function: 'formatValue'
  });

  let result;

  // For brightness and contrast, show 0-100% range
  if (paramKey === 'brightness' || paramKey === 'contrast') {
    const uiVal = ((val - 0.5) * 100).toFixed(0);
    result = `${uiVal}%`;
  }
  // For rotation, show degrees
  else if (paramKey === 'rotation') {
    result = `${val}°`;
  }
  // For scale, show as percentage
  else if (paramKey === 'scale') {
    result = `${val}%`;
  }
  // Default formatting
  else {
    result = val.toFixed(2);
  }

  logInfo('app.frontend.ui', 'format_value_result', 'formatValue result returned', {
    timestamp: new Date().toISOString(),
    paramKey: paramKey,
    inputValue: val,
    result: result,
    function: 'formatValue'
  });

  return result;
};