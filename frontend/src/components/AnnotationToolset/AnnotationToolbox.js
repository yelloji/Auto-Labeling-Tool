/**
 * AnnotationToolbox.js
 * Right sidebar with annotation tools - Professional Roboflow-like design
 */

import React, { useEffect, useRef } from 'react';
import { Button, Tooltip, Divider, InputNumber, Typography } from 'antd';
import {
  DragOutlined,
  BorderOutlined,
  ExpandOutlined,
  AimOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  RedoOutlined,
  DeleteOutlined,
  ClearOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const { Text } = Typography;

const AnnotationToolbox = ({
  activeTool,
  onToolChange,
  zoomLevel = 100,
  onZoomChange,
  onUndo,
  onRedo,
  onClear,
  onSave,
  canUndo = false,
  canRedo = false
}) => {
  // One-time mount log to verify component is rendering
  const hasLoggedMountRef = useRef(false);
  useEffect(() => {
    if (!hasLoggedMountRef.current) {
      hasLoggedMountRef.current = true;
      // Explicit console logs to help diagnose missing logs in user console
      console.log('AnnotationToolbox mounted. Current props =>', { activeTool, zoomLevel, canUndo, canRedo });
    }
  }, [activeTool, zoomLevel, canUndo, canRedo]);

  const tools = [
    { key: 'select', icon: DragOutlined, tooltip: 'Select & Move', label: 'Select' },
    { key: 'box', icon: BorderOutlined, tooltip: 'Rectangle Tool', label: 'Box' },
    { key: 'polygon', icon: ExpandOutlined, tooltip: 'Manual Polygon Tool', label: 'Polygon' },
    { key: 'smart_polygon', icon: ThunderboltOutlined, tooltip: 'Smart Polygon - Click to auto-generate polygon around objects', label: 'Smart' }
  ];

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 25, 500);
    onZoomChange(newZoom);
    logInfo('app.frontend.ui', 'zoom_in_operation', 'Zoom in operation performed', {
      oldZoom: zoomLevel,
      newZoom: newZoom,
      zoomChange: 25
    }).catch(err => console.error('Logging error:', err));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 25, 25);
    onZoomChange(newZoom);
    logInfo('app.frontend.ui', 'zoom_out_operation', 'Zoom out operation performed', {
      oldZoom: zoomLevel,
      newZoom: newZoom,
      zoomChange: -25
    }).catch(err => console.error('Logging error:', err));
  };

  const handleZoomChange = (value) => {
    if (value && value >= 25 && value <= 500) {
      onZoomChange(value);
      try {
        logInfo('app.frontend.ui', 'zoom_level_changed', 'Zoom level changed via input', {
          oldZoom: zoomLevel,
          newZoom: value,
          zoomChange: value - zoomLevel
        });
      } catch (e) {
        console.warn('Logging failed in handleZoomChange:', e);
      }
    } else {
      try {
        logError('app.frontend.validation', 'zoom_level_invalid', 'Invalid zoom level attempted', {
          attemptedValue: value,
          minZoom: 25,
          maxZoom: 500,
          currentZoom: zoomLevel
        });
      } catch (e) {
        console.warn('Logging failed in handleZoomChange (invalid):', e);
      }
    }
  };

  const handleToolChange = (toolKey) => {
    console.log('🎯 AnnotationToolbox - Tool button clicked:', toolKey);
    console.log('🎯 Current activeTool in toolbox:', activeTool);
    // Call onToolChange immediately to ensure UI responsiveness
    onToolChange(toolKey);
    // Log asynchronously without blocking UI
    logInfo('app.frontend.interactions', 'annotation_tool_changed', 'Annotation tool changed', {
      previousTool: activeTool,
      newTool: toolKey,
      toolLabel: tools.find(t => t.key === toolKey)?.label
    }).catch(err => console.error('Logging error:', err));
  };

  const handleUndo = () => {
    if (canUndo) {
      onUndo();
      try {
        logInfo('app.frontend.interactions', 'undo_operation', 'Undo operation performed', {
          canUndo: canUndo,
          canRedo: canRedo
        });
      } catch (e) {
        console.warn('Logging failed in handleUndo:', e);
      }
    } else {
      try {
        logError('app.frontend.validation', 'undo_disabled', 'Undo operation attempted when disabled', {
          canUndo: canUndo,
          canRedo: canRedo
        });
      } catch (e) {
        console.warn('Logging failed in handleUndo (disabled):', e);
      }
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      onRedo();
      try {
        logInfo('app.frontend.interactions', 'redo_operation', 'Redo operation performed', {
          canUndo: canUndo,
          canRedo: canRedo
        });
      } catch (e) {
        console.warn('Logging failed in handleRedo:', e);
      }
    } else {
      try {
        logError('app.frontend.validation', 'redo_disabled', 'Redo operation attempted when disabled', {
          canUndo: canUndo,
          canRedo: canRedo
        });
      } catch (e) {
        console.warn('Logging failed in handleRedo (disabled):', e);
      }
    }
  };

  const handleClear = () => {
    onClear();
    logInfo('app.frontend.interactions', 'clear_all_operation', 'Clear all operation initiated', {
      activeTool: activeTool,
      zoomLevel: zoomLevel
    }).catch(err => console.error('Logging error:', err));
  };

  // Remove Save All: redundant due to auto-save behavior
  // const handleSave = () => {
  //   onSave();
  //   logInfo('app.frontend.interactions', 'save_all_operation', 'Save all operation initiated', {
  //     activeTool: activeTool,
  //     zoomLevel: zoomLevel
  //   }).catch(err => console.error('Logging error:', err));
  // };

  const handleDelete = () => {
    console.log('Delete');
    logInfo('app.frontend.interactions', 'delete_selected_operation', 'Delete selected operation initiated', {
      activeTool: activeTool,
      zoomLevel: zoomLevel
    }).catch(err => console.error('Logging error:', err));
  };

  const ToolButton = ({ tool, isActive, onClick }) => {
    const activatedRef = useRef(false);

    const activate = () => {
      if (activatedRef.current) return;
      activatedRef.current = true;
      try {
        onClick();
        logUserClick('AnnotationToolbox', `${tool.key}_tool_button`, {
          toolKey: tool.key,
          toolLabel: tool.label,
          isActive: isActive,
          tooltip: tool.tooltip
        }).catch(() => {});
      } catch (_) {}
      // reset guard shortly after to allow next activations
      setTimeout(() => { activatedRef.current = false; }, 200);
    };

    return (
      <Tooltip title={tool.tooltip} placement="left">
        <div
          data-tool-wrapper={tool.key}
          onClick={(e) => {
            console.log('🧩 Tool wrapper clicked:', tool.key);
          }}
          onMouseDown={(e) => {
            console.log('🧩 Tool wrapper mousedown:', tool.key, 'button:', e.button);
          }}
          style={{ display: 'flex', userSelect: 'none' }}
        >
          <Button
            type={isActive ? 'primary' : 'default'}
            icon={<tool.icon style={{ fontSize: '14px' }} />}
            data-tool-key={tool.key}
            onMouseDown={(e) => {
              console.log('🖱️ onMouseDown: ToolButton', tool.key, { button: e.button });
              // Ensure the toolbox receives the interaction and prevent the canvas from stealing the mouseup
              e.preventDefault();
              e.stopPropagation();
              activate();
            }}
            onClick={() => {
              console.log('🎯 ToolButton clicked:', tool.key);
              activate();
            }}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1px',
              background: isActive ? '#3498db' : '#34495e',
              borderColor: isActive ? '#3498db' : '#001529',
              color: isActive ? '#fff' : '#bdc3c7',
              borderRadius: '6px',
              boxShadow: isActive ? '0 2px 6px rgba(52, 152, 219, 0.25)' : '0 1px 2px rgba(0,0,0,0.08)',
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              zIndex: 2100,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget;
              if (!isActive) {
                btn.style.background = '#3498db';
                btn.style.borderColor = '#3498db';
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget;
              if (!isActive) {
                btn.style.background = '#34495e';
                btn.style.borderColor = '#001529';
              }
            }}
          >
            <Text 
              style={{ 
                fontSize: '8px', 
                color: isActive ? '#fff' : '#bdc3c7',
                fontWeight: '500',
                lineHeight: 1
              }}
            >
              {tool.label}
            </Text>
          </Button>
        </div>
      </Tooltip>
    );
  };

  const ActionButton = ({ icon, tooltip, onClick, disabled = false, color = '#595959' }) => {
    const activatedRef = useRef(false);

    const activate = () => {
      if (activatedRef.current || disabled) return;
      activatedRef.current = true;
      try {
        onClick();
        logUserClick('AnnotationToolbox', `${tooltip.toLowerCase().replace(/\s+/g, '_')}_button`, {
          tooltip: tooltip,
          disabled: disabled,
          color: color
        }).catch(() => {});
      } catch (_) {}
      setTimeout(() => { activatedRef.current = false; }, 200);
    };

    return (
      <Tooltip title={tooltip} placement="left">
        <Button
          icon={React.cloneElement(icon, { style: { fontSize: '12px' } })}
          onMouseDown={(e) => {
            console.log('🖱️ onMouseDown: ActionButton', tooltip, { button: e.button });
            e.preventDefault();
            e.stopPropagation();
            activate();
          }}
          onClick={() => {
            activate();
          }}
          disabled={disabled}
          style={{
            width: '40px',
            height: '32px',
            background: '#34495e',
            borderColor: '#001529',
            color: disabled ? '#7f8c8d' : '#bdc3c7',
            borderRadius: '4px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget;
            if (!disabled) {
              btn.style.background = '#3498db';
              btn.style.borderColor = '#3498db';
            }
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget;
            if (!disabled) {
              btn.style.background = '#34495e';
              btn.style.borderColor = '#001529';
            }
          }}
        />
      </Tooltip>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#001529',
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderLeft: '1px solid #34495e'
      }}
      onClick={() => {
        // Container click to detect if pointer events are reaching the toolbox at all
        console.log('AnnotationToolbox container clicked');
      }}
     >
      {/* Section: Drawing Tools */}
      <div>
        <Text 
          style={{ 
            fontSize: '9px', 
            color: '#95a5a6', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            display: 'block'
          }}
        >
          TOOLS
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tools.map(tool => (
            <ToolButton
              key={tool.key}
              tool={tool}
              isActive={activeTool === tool.key}
              onClick={() => handleToolChange(tool.key)}
            />
          ))}
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      {/* Section: View Controls */}
      <div>
        <Text 
          style={{ 
            fontSize: '9px', 
            color: '#95a5a6', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            display: 'block'
          }}
        >
          VIEW
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          <ActionButton
            icon={<ZoomInOutlined />}
            tooltip="Zoom In"
            onClick={handleZoomIn}
          />
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '2px',
            padding: '4px',
            background: '#34495e',
            borderRadius: '4px',
            border: '1px solid #001529',
            width: '40px'
          }}>
            <InputNumber
              value={zoomLevel}
              onChange={handleZoomChange}
              min={25}
              max={500}
              step={25}
              size="small"
              style={{ 
                width: '32px',
                textAlign: 'center',
                fontSize: '10px'
              }}
              controls={false}
            />
            <Text style={{ 
              color: '#bdc3c7', 
              fontSize: '8px',
              fontWeight: '500'
            }}>
              %
            </Text>
          </div>

          <ActionButton
            icon={<ZoomOutOutlined />}
            tooltip="Zoom Out"
            onClick={handleZoomOut}
          />
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      {/* Section: History */}
      <div>
        <Text 
          style={{ 
            fontSize: '9px', 
            color: '#95a5a6', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            display: 'block'
          }}
        >
          HISTORY
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <ActionButton
            icon={<UndoOutlined />}
            tooltip="Undo"
            onClick={handleUndo}
            disabled={!canUndo}
          />
          <ActionButton
            icon={<RedoOutlined />}
            tooltip="Redo"
            onClick={handleRedo}
            disabled={!canRedo}
          />
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      {/* Section: Actions */}
      <div>
        <Text 
          style={{ 
            fontSize: '9px', 
            color: '#95a5a6', 
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            display: 'block'
          }}
        >
          ACTIONS
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <ActionButton
            icon={<DeleteOutlined />}
            tooltip="Delete Selected"
            onClick={handleDelete}
            color="#ff4d4f"
          />
          <ActionButton
            icon={<ClearOutlined />}
            tooltip="Clear All"
            onClick={handleClear}
            color="#ff7875"
          />
          {/* Save All removed due to auto-save */}
        </div>
      </div>
    </div>
  );
};

export default AnnotationToolbox;