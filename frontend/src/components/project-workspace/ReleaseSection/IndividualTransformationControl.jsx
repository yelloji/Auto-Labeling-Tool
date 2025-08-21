import React, { useState, useEffect } from 'react';
import { Slider, InputNumber, Switch, Space, Tooltip, Button, Divider, Typography, Select } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { formatValue, getUnitLabel } from './transformationUtils';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { Option } = Select;
const { Text } = Typography;

const IndividualTransformationControl = ({ 
  paramKey, 
  paramDef, 
  value, 
  minValue, 
  maxValue, 
  onChange, 
  onRangeChange,
  enabled = true,
  parameterRanges = {},
  setParameterRanges = () => {},
  isRangeMode = false,
  onToggleRangeMode = () => {}
}) => {
  // Special parameters that show relative values (e.g., +20% instead of 1.2)
  const isSpecialParameter = paramKey === 'brightness' || paramKey === 'contrast';
  
  useEffect(() => {
    logInfo('app.frontend.ui', 'individual_transformation_control_initialized', 'IndividualTransformationControl component initialized', {
      timestamp: new Date().toISOString(),
      component: 'IndividualTransformationControl',
      paramKey: paramKey,
      paramDef: paramDef,
      value: value,
      enabled: enabled,
      isRangeMode: isRangeMode,
      isSpecialParameter: isSpecialParameter
    });
  }, [paramKey, paramDef, value, enabled, isRangeMode, isSpecialParameter]);
  
  // Get default range for a parameter based on its current value
  const getDefaultRange = (paramKey, value, paramDef) => {
    logInfo('app.frontend.ui', 'get_default_range_called', 'getDefaultRange function called', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      value: value,
      paramDef: paramDef,
      function: 'getDefaultRange'
    });

    let result;
    if (paramKey === 'brightness' || paramKey === 'contrast') {
      // For brightness/contrast, create a range of ±X% around 1.0 (normal)
      // If value is 1.1 (+10%), range will be [0.9, 1.1] (±10%)
      const deviation = Math.abs(value - 1.0);
      result = [Math.max(1.0 - deviation, paramDef.min), Math.min(1.0 + deviation, paramDef.max)];
    } else if (paramKey === 'rotation') {
      // For rotation, create a symmetric range around 0
      // If value is 30, range will be [-30, 30]
      result = [-Math.abs(value), Math.abs(value)];
    } else {
      // For other parameters, create a range of ±20% around the value
      const range = value * 0.2; // 20% of the value
      result = [
        Math.max(value - range, paramDef.min), 
        Math.min(value + range, paramDef.max)
      ];
    }

    logInfo('app.frontend.ui', 'get_default_range_result', 'getDefaultRange result calculated', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      value: value,
      result: result,
      function: 'getDefaultRange'
    });

    return result;
  };

  // Handle changes to a single parameter value
  const handleParameterChange = (paramKey, newValue) => {
    logInfo('app.frontend.interactions', 'parameter_change_started', 'Parameter change started', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      oldValue: value,
      newValue: newValue,
      function: 'handleParameterChange'
    });

    // Ensure newValue is a valid number
    if (newValue === null || isNaN(newValue)) {
      logError('app.frontend.validation', 'invalid_parameter_value', 'Invalid parameter value provided', {
        timestamp: new Date().toISOString(),
        paramKey: paramKey,
        newValue: newValue,
        function: 'handleParameterChange'
      });
      console.warn(`Invalid value for ${paramKey}:`, newValue);
      return;
    }
    
    // Update the single value
    onChange(paramKey, newValue);
    
    // Also update the range that will be used behind the scenes
    const [min, max] = getDefaultRange(paramKey, newValue, paramDef);
    setParameterRanges({
      ...parameterRanges,
      [paramKey]: [min, max]
    });

    logInfo('app.frontend.interactions', 'parameter_change_completed', 'Parameter change completed', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      newValue: newValue,
      calculatedRange: [min, max],
      function: 'handleParameterChange'
    });
  };

  // Handle changes to a range (min/max values)
  const handleRangeChange = (paramKey, [newMin, newMax]) => {
    logInfo('app.frontend.interactions', 'range_change_started', 'Range change started', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      oldRange: [minValue, maxValue],
      newRange: [newMin, newMax],
      function: 'handleRangeChange'
    });

    onRangeChange(paramKey, newMin, newMax);

    logInfo('app.frontend.interactions', 'range_change_completed', 'Range change completed', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      newRange: [newMin, newMax],
      function: 'handleRangeChange'
    });
  };

  // Toggle between single value and range mode
  const toggleRangeMode = () => {
    logUserClick('range_mode_toggle_clicked', 'User toggled range mode');
    logInfo('app.frontend.ui', 'range_mode_toggle_started', 'Range mode toggle started', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      currentMode: isRangeMode,
      newMode: !isRangeMode,
      function: 'toggleRangeMode'
    });

    onToggleRangeMode(paramKey, !isRangeMode);

    logInfo('app.frontend.ui', 'range_mode_toggle_completed', 'Range mode toggle completed', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      newMode: !isRangeMode,
      function: 'toggleRangeMode'
    });
  };

  // This function renders a single slider that generates ranges behind the scenes
  const renderEnhancedSingleSlider = (paramKey, paramDef, value, isSpecialParameter) => {
    logInfo('app.frontend.ui', 'enhanced_single_slider_rendered', 'Enhanced single slider rendered', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      value: value,
      isSpecialParameter: isSpecialParameter,
      function: 'renderEnhancedSingleSlider'
    });

    // Get appropriate unit label
    const unitLabel = getUnitLabel(paramKey, paramDef);
    
    // For brightness and contrast, show relative values as simple percentages
    const displayValue = isSpecialParameter ? 
      ((value - 1.0) * 100).toFixed(0) : // Shows as -20 or +20 without % sign (added by addonAfter)
      value;
      
    // For UI display, convert the -50% to +50% range to 0-100% range
    const uiDisplayValue = isSpecialParameter ? 
      ((value - 0.5) / 1.0) * 100 : // Convert from 0.5-1.5 range to 0-100% range
      value;
    
    console.log(`Parameter: ${paramKey}, Actual value: ${value}, UI Display Value: ${uiDisplayValue}%`);
    
    // Get the range that will be generated from this value
    const [minValue, maxValue] = parameterRanges[paramKey] || 
      getDefaultRange(paramKey, value, paramDef);
    
    // Calculate the range size for display in tooltip
    let rangeDescription = '';
    
    if (paramKey === 'brightness' || paramKey === 'contrast') {
      // For brightness/contrast, show as ±X%
      const percentage = Math.abs((value - 1.0) * 100).toFixed(0);
      rangeDescription = `±${percentage}% (${formatValue(paramKey, minValue)} to ${formatValue(paramKey, maxValue)})`;
    } else if (paramKey === 'rotation') {
      // For rotation, show as ±X°
      rangeDescription = `±${Math.abs(value)}° (${minValue}° to ${maxValue}°)`;
    } else {
      // For other parameters, show as ±X%
      const percentage = 20; // Default 20%
      rangeDescription = `±${percentage}% (${minValue.toFixed(2)} to ${maxValue.toFixed(2)})`;
    }
    
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 4
        }}>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
            <span style={{ fontSize: '10px', color: '#999', marginLeft: 4 }}>
              {unitLabel}
            </span>
          </span>
          <Space>
            <Tooltip title={`Range: ${rangeDescription}`}>
              <InputNumber
                size="small"
                value={isSpecialParameter ? uiDisplayValue : displayValue}
                min={isSpecialParameter ? 0 : paramDef.min}
                max={isSpecialParameter ? 100 : paramDef.max}
                step={isSpecialParameter ? 1 : (paramDef.step || 0.01)}
                onChange={(val) => {
                  logInfo('app.frontend.interactions', 'input_number_change', 'InputNumber value changed', {
                    timestamp: new Date().toISOString(),
                    paramKey: paramKey,
                    newValue: val,
                    isSpecialParameter: isSpecialParameter,
                    function: 'renderEnhancedSingleSlider'
                  });
                  console.log(`InputNumber change: ${paramKey} = ${val}`);
                  // For brightness/contrast, convert from percentage to factor
                  if (isSpecialParameter && val !== null) {
                    const actualValue = 0.5 + (val / 100);
                    console.log(`InputNumber converted: ${val}% -> ${actualValue}`);
                    handleParameterChange(paramKey, actualValue);
                  } else {
                    handleParameterChange(paramKey, val);
                  }
                }}
                onBlur={() => {
                  logInfo('app.frontend.ui', 'input_number_blur', 'InputNumber blur event', {
                    timestamp: new Date().toISOString(),
                    paramKey: paramKey,
                    value: value,
                    function: 'renderEnhancedSingleSlider'
                  });
                  // Force update on blur to ensure value is committed
                  console.log(`InputNumber blur: ${paramKey} = ${value}`);
                  handleParameterChange(paramKey, value);
                }}
                disabled={!enabled}
                style={{ width: 70 }}
                addonAfter={isSpecialParameter ? '%' : ''}
              />
            </Tooltip>
          </Space>
        </div>
        
        {/* Single slider for all parameter types */}
        {isSpecialParameter ? (
          // For brightness and contrast, use 0-100% UI range
          <Slider
            value={uiDisplayValue}
            min={0}
            max={100}
            step={1}
            onChange={(val) => {
              logInfo('app.frontend.interactions', 'special_slider_change', 'Special parameter slider changed', {
                timestamp: new Date().toISOString(),
                paramKey: paramKey,
                uiValue: val,
                function: 'renderEnhancedSingleSlider'
              });
              // Convert back from 0-100% UI range to actual parameter range (0.5-1.5)
              const actualValue = 0.5 + (val / 100);
              console.log(`Slider change: ${paramKey} UI=${val}%, actual=${actualValue}`);
              handleParameterChange(paramKey, actualValue);
            }}
            onAfterChange={(val) => {
              logInfo('app.frontend.interactions', 'special_slider_after_change', 'Special parameter slider after change', {
                timestamp: new Date().toISOString(),
                paramKey: paramKey,
                uiValue: val,
                actualValue: 0.5 + (val / 100),
                function: 'renderEnhancedSingleSlider'
              });
              // Convert back from 0-100% UI range to actual parameter range (0.5-1.5)
              const actualValue = 0.5 + (val / 100);
              console.log(`Slider after change: ${paramKey} UI=${val}%, actual=${actualValue}`);
              handleParameterChange(paramKey, actualValue);
            }}
            disabled={!enabled}
            tooltip={{ 
              formatter: (val) => {
                // Convert UI value back to actual value for tooltip
                const actualValue = 0.5 + (val / 100);
                console.log(`Tooltip: UI=${val}%, Actual=${actualValue}, Display=${formatValue(paramKey, actualValue)}`);
                return formatValue(paramKey, actualValue);
              },
              placement: 'top'
            }}
            marks={{
              0: '0%',
              50: 'Normal',
              100: '100%'
            }}
            data-min="0%"
            data-max="100%"
          />
        ) : (
          // For other parameters, use normal range
          <Slider
            value={value}
            min={paramDef.min}
            max={paramDef.max}
            step={paramDef.step || 0.01}
            onChange={(val) => {
              logInfo('app.frontend.interactions', 'normal_slider_change', 'Normal parameter slider changed', {
                timestamp: new Date().toISOString(),
                paramKey: paramKey,
                newValue: val,
                function: 'renderEnhancedSingleSlider'
              });
              handleParameterChange(paramKey, val);
            }}
            onAfterChange={(val) => {
              logInfo('app.frontend.interactions', 'normal_slider_after_change', 'Normal parameter slider after change', {
                timestamp: new Date().toISOString(),
                paramKey: paramKey,
                finalValue: val,
                function: 'renderEnhancedSingleSlider'
              });
              // Force update after slider interaction ends
              console.log(`Slider after change: ${paramKey} = ${val}`);
              handleParameterChange(paramKey, val);
            }}
            disabled={!enabled}
            tooltip={{ 
              formatter: (val) => formatValue(paramKey, val),
              placement: 'top'
            }}
            data-min={paramDef.min + '%'}
            data-max={paramDef.max + '%'}
          />
        )}
      </div>
    );
  };
  
  // This function renders a range slider with two handles
  const renderRangeSlider = (paramKey, paramDef, minValue, maxValue) => {
    logInfo('app.frontend.ui', 'range_slider_rendered', 'Range slider rendered', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      minValue: minValue,
      maxValue: maxValue,
      function: 'renderRangeSlider'
    });

    // Get appropriate unit label
    const unitLabel = getUnitLabel(paramKey, paramDef);
    
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 4
        }}>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
            <span style={{ fontSize: '10px', color: '#999', marginLeft: 4 }}>
              {unitLabel}
            </span>
          </span>
          <Space>
            <InputNumber
              size="small"
              value={minValue}
              min={paramDef.min}
              max={maxValue}
              step={paramDef.step || 0.1}
              onChange={(val) => {
                logInfo('app.frontend.interactions', 'range_min_input_change', 'Range min input changed', {
                  timestamp: new Date().toISOString(),
                  paramKey: paramKey,
                  newMinValue: val,
                  currentMaxValue: maxValue,
                  function: 'renderRangeSlider'
                });
                console.log(`Min InputNumber change: ${paramKey} = ${val}`);
                handleRangeChange(paramKey, [val, maxValue]);
              }}
              onBlur={() => {
                logInfo('app.frontend.ui', 'range_min_input_blur', 'Range min input blur event', {
                  timestamp: new Date().toISOString(),
                  paramKey: paramKey,
                  minValue: minValue,
                  function: 'renderRangeSlider'
                });
                // Force update on blur to ensure value is committed
                console.log(`Min InputNumber blur: ${paramKey} = ${minValue}`);
                handleRangeChange(paramKey, [minValue, maxValue]);
              }}
              disabled={!enabled}
              style={{ width: 70 }}
            />
            <span>-</span>
            <InputNumber
              size="small"
              value={maxValue}
              min={minValue}
              max={paramDef.max}
              step={paramDef.step || 0.1}
              onChange={(val) => {
                logInfo('app.frontend.interactions', 'range_max_input_change', 'Range max input changed', {
                  timestamp: new Date().toISOString(),
                  paramKey: paramKey,
                  newMaxValue: val,
                  currentMinValue: minValue,
                  function: 'renderRangeSlider'
                });
                console.log(`Max InputNumber change: ${paramKey} = ${val}`);
                handleRangeChange(paramKey, [minValue, val]);
              }}
              onBlur={() => {
                logInfo('app.frontend.ui', 'range_max_input_blur', 'Range max input blur event', {
                  timestamp: new Date().toISOString(),
                  paramKey: paramKey,
                  maxValue: maxValue,
                  function: 'renderRangeSlider'
                });
                // Force update on blur to ensure value is committed
                console.log(`Max InputNumber blur: ${paramKey} = ${maxValue}`);
                handleRangeChange(paramKey, [minValue, maxValue]);
              }}
              disabled={!enabled}
              style={{ width: 70 }}
            />
          </Space>
        </div>
        
        <Slider
          range
          value={[minValue, maxValue]}
          min={paramDef.min}
          max={paramDef.max}
          step={paramDef.step || 0.1}
          onChange={(val) => {
            logInfo('app.frontend.interactions', 'range_slider_change', 'Range slider changed', {
              timestamp: new Date().toISOString(),
              paramKey: paramKey,
              newRange: val,
              function: 'renderRangeSlider'
            });
            handleRangeChange(paramKey, val);
          }}
          onAfterChange={(val) => {
            logInfo('app.frontend.interactions', 'range_slider_after_change', 'Range slider after change', {
              timestamp: new Date().toISOString(),
              paramKey: paramKey,
              finalRange: val,
              function: 'renderRangeSlider'
            });
            // Force update after slider interaction ends
            console.log(`Range slider after change: ${paramKey} = [${val[0]}, ${val[1]}]`);
            handleRangeChange(paramKey, val);
          }}
          disabled={!enabled}
          tooltip={{ 
            formatter: (val) => formatValue(paramKey, val) 
          }}
          data-min={paramDef.min + '%'}
          data-max={paramDef.max + '%'}
        />
      </div>
    );
  };

  // Render the appropriate control based on parameter type
  const renderParameterControl = () => {
    logInfo('app.frontend.ui', 'parameter_control_rendered', 'Parameter control rendered', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      paramType: paramDef.type,
      value: value,
      function: 'renderParameterControl'
    });

    if (paramDef.type === 'number') {
      // For numeric parameters, render the enhanced single slider
      return renderEnhancedSingleSlider(paramKey, paramDef, value, isSpecialParameter);
    } else if (paramDef.type === 'select') {
      // For select parameters, render a dropdown
      return (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
            </span>
          </div>
          <Select
            style={{ width: '100%' }}
            value={value}
            onChange={(val) => {
              logInfo('app.frontend.interactions', 'select_option_changed', 'Select option changed', {
                timestamp: new Date().toISOString(),
                paramKey: paramKey,
                oldValue: value,
                newValue: val,
                function: 'renderParameterControl'
              });
              onChange(paramKey, val);
            }}
            disabled={!enabled}
          >
            {paramDef.options.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>
      );
    } else if (paramDef.type === 'boolean') {
      // For boolean parameters, render a switch
      return (
        <div style={{ marginBottom: 12 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
            </span>
            <Switch
              checked={value}
              onChange={(checked) => {
                logInfo('app.frontend.interactions', 'boolean_switch_changed', 'Boolean switch changed', {
                  timestamp: new Date().toISOString(),
                  paramKey: paramKey,
                  oldValue: value,
                  newValue: checked,
                  function: 'renderParameterControl'
                });
                onChange(paramKey, checked);
              }}
              disabled={!enabled}
            />
          </div>
        </div>
      );
    }
    
    logInfo('app.frontend.ui', 'parameter_control_no_type', 'No parameter type matched', {
      timestamp: new Date().toISOString(),
      paramKey: paramKey,
      paramType: paramDef.type,
      function: 'renderParameterControl'
    });
    
    return null;
  };

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'individual_transformation_control_rendered', 'IndividualTransformationControl component rendered', {
    timestamp: new Date().toISOString(),
    component: 'IndividualTransformationControl',
    paramKey: paramKey,
    paramType: paramDef.type,
    value: value,
    enabled: enabled,
    isRangeMode: isRangeMode,
    isSpecialParameter: isSpecialParameter
  });

  return renderParameterControl();
};

export default IndividualTransformationControl;