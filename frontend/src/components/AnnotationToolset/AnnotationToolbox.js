/**
 * AnnotationToolbox.js
 * Right sidebar with annotation tools - Professional Roboflow-like design
 */

import React, { useEffect, useRef } from 'react';
import { Button, Tooltip, Divider, InputNumber, Typography, message } from 'antd';
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
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  BlockOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';
import { Modal } from 'antd';
import AnnotationAPI from './AnnotationAPI';

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
  canRedo = false,
  onDeleteImage,
  onMarkAsNull,
  isLabeledNull = false,
  annotations = []
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
    { key: 'select', icon: DragOutlined, tooltip: 'Select & Edit: Click to select, move, or resize existing annotations on the canvas.', label: 'Select' },
    { key: 'box', icon: BorderOutlined, tooltip: 'Bounding Box: Draw a rectangular area to define object boundaries for detection.', label: 'Box' },
    { key: 'polygon', icon: ExpandOutlined, tooltip: 'Manual Polygon: Define precise object boundaries by placing sequential points.', label: 'Polygon' },
    { key: 'smart_polygon', icon: ThunderboltOutlined, tooltip: 'Magic Wand: Leverages AI to automatically segment objects with a single click.', label: 'Smart' },
    { key: 'null', icon: BlockOutlined, tooltip: isLabeledNull ? 'Remove Null: Click to unmark this image as background' : 'Mark as Null: Confirm this image contains no objects (works only on clean images)', label: 'Null' }
  ];

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 25, 500);
    onZoomChange(newZoom);
    logInfo('app.frontend.ui', 'zoom_in_operation', 'Zoom in operation performed', {
      oldZoom: zoomLevel,
      newZoom: newZoom,
      zoomChange: 25
    }).catch(err => console.error('Logging error:', err));
    // Define handleDeleteImage inside the component
  };

  function handleDeleteImage() {
    if (onDeleteImage) {
      onDeleteImage();
      logInfo('app.frontend.interactions', 'delete_image_operation', 'Delete image operation initiated', {
        activeTool: activeTool,
        zoomLevel: zoomLevel
      }).catch(err => console.error('Logging error:', err));
    } else if (window.imageId) {
      AnnotationAPI.deleteImage(window.imageId)
        .then(() => {
          console.log('Image deleted successfully');
          window.location.reload();
        })
        .catch(err => {
          console.error('Failed to delete image:', err);
        });
    } else {
      logError('app.frontend.validation', 'delete_image_disabled', 'Delete image attempted when disabled', {
        activeTool: activeTool,
        zoomLevel: zoomLevel
      });
    }
  }


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
    console.log('🔄 Undo button clicked! canUndo:', canUndo, 'onUndo function:', typeof onUndo);
    if (canUndo) {
      console.log('✅ Calling onUndo function...');
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
      console.log('❌ Undo disabled - canUndo is false');
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
    console.log('🔄 Redo button clicked! canRedo:', canRedo, 'onRedo function:', typeof onRedo);
    if (canRedo) {
      console.log('✅ Calling onRedo function...');
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
      console.log('❌ Redo disabled - canRedo is false');
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
    if (onClear) {
      onClear();
      logInfo('app.frontend.interactions', 'clear_all_operation', 'Clear all operation initiated', {
        activeTool: activeTool,
        zoomLevel: zoomLevel
      }).catch(err => console.error('Logging error:', err));
    } else {
      console.warn('No onClear handler provided');
      logError('app.frontend.validation', 'clear_all_disabled', 'Clear all operation attempted when handler not available', {
        activeTool: activeTool,
        zoomLevel: zoomLevel
      }).catch(err => console.error('Logging error:', err));
    }
  };

  // Remove Save All: redundant due to auto-save behavior
  // const handleSave = () => {
  //   onSave();
  //   logInfo('app.frontend.interactions', 'save_all_operation', 'Save all operation initiated', {
  //     activeTool: activeTool,
  //     zoomLevel: zoomLevel
  //   }).catch(err => console.error('Logging error:', err));
  // };



  const ToolButton = ({ tool, isActive, onClick, disabled = false }) => {
    const activate = () => {
      if (disabled) {
        message.warning('Drawing tools are disabled when image is marked as null');
        return;
      }
      logUserClick('AnnotationToolbox', `tool_${tool.key}_activated`, {
        toolKey: tool.key,
        toolLabel: tool.label,
        wasActive: isActive,
        timestamp: new Date().toISOString()
      });
      logInfo('app.frontend.interactions', 'tool_activated', `Tool activated: ${tool.label}`, {
        toolKey: tool.key,
        isActive,
        timestamp: new Date().toISOString()
      });
      onClick();
    };

    return (
      <div
        data-tool-wrapper={tool.key}
        style={{ display: 'flex', userSelect: 'none', pointerEvents: 'auto' }}
      >
        <Tooltip
          title={tool.tooltip}
          placement="left"
          mouseLeaveDelay={0.1}
          overlayStyle={{ zIndex: 100000 }}
          trigger="hover"
        >
          <Button
            type={isActive ? 'primary' : 'default'}
            icon={<tool.icon style={{ fontSize: '1rem' }} />}
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
              width: '3rem',
              height: '3.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.125rem',
              padding: '0.25rem 0',
              background: disabled ? '#2c3e50' : (isActive ? '#3498db' : '#34495e'),
              borderColor: disabled ? '#1a252f' : (isActive ? '#3498db' : '#001529'),
              color: disabled ? '#7f8c8d' : (isActive ? '#fff' : '#bdc3c7'),
              borderRadius: '0.375rem',
              boxShadow: isActive ? '0 0.125rem 0.375rem rgba(52, 152, 219, 0.25)' : '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              zIndex: 2100,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget;
              if (!isActive && !disabled) {
                btn.style.background = '#3498db';
                btn.style.borderColor = '#3498db';
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget;
              if (!isActive && !disabled) {
                btn.style.background = '#34495e';
                btn.style.borderColor = '#001529';
              }
            }}
          >
            <Text
              style={{
                fontSize: '0.6875rem',
                color: isActive ? '#fff' : '#bdc3c7',
                fontWeight: '500',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                marginTop: 'auto'
              }}
            >
              {tool.label}
            </Text>
          </Button>
        </Tooltip>
      </div>
    );
  };

  const ActionButton = ({ icon, tooltip, onClick, disabled = false, color = '#595959', label }) => {
    const activatedRef = useRef(false);

    const activate = () => {
      console.log('🎯 ActionButton activate called:', { tooltip, disabled, activatedRef: activatedRef.current });
      if (activatedRef.current || disabled) {
        console.log('❌ ActionButton activation blocked:', { alreadyActivated: activatedRef.current, disabled });
        return;
      }
      activatedRef.current = true;
      try {
        console.log('✅ ActionButton calling onClick for:', tooltip);
        onClick();
        logUserClick('AnnotationToolbox', `${tooltip.toLowerCase().replace(/\s+/g, '_')}_button`, {
          tooltip: tooltip,
          disabled: disabled,
          color: color
        }).catch(() => { });
      } catch (e) {
        console.error('❌ ActionButton onClick error:', e);
      }
      setTimeout(() => { activatedRef.current = false; }, 200);
    };

    return (
      <Tooltip
        title={tooltip}
        placement="left"
        mouseLeaveDelay={0.1}
        overlayStyle={{ zIndex: 100000 }}
        trigger="hover"
      >
        <Button
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
            width: label ? '3rem' : '2.5rem',
            height: label ? '3.25rem' : '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: label ? '0.125rem' : '0',
            padding: label ? '0.25rem 0' : '0',
            background: disabled ? '#2c3e50' : '#34495e',
            borderColor: '#001529',
            color: disabled ? '#7f8c8d' : '#bdc3c7',
            borderRadius: label ? '0.375rem' : '0.25rem',
            boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease',
            cursor: disabled ? 'not-allowed' : 'pointer',
            paddingTop: label ? '0.25rem' : '0'
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget;
            if (!disabled) {
              btn.style.background = '#3498db';
              btn.style.borderColor = '#3498db';
              btn.style.cursor = 'pointer';
            } else {
              btn.style.cursor = 'not-allowed';
            }
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget;
            if (!disabled) {
              btn.style.background = '#34495e';
              btn.style.borderColor = '#001529';
            }
          }}
        >
          {React.cloneElement(icon, { style: { fontSize: '1rem', marginBottom: label ? 'auto' : '0' } })}
          {label && (
            <Text
              style={{
                fontSize: '0.6875rem',
                color: disabled ? '#7f8c8d' : '#bdc3c7',
                fontWeight: '500',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                marginTop: 'auto'
              }}
            >
              {label}
            </Text>
          )}
        </Button>
      </Tooltip>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#001529',
        padding: '0.375rem 0.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        borderLeft: '0.0625rem solid #34495e'
      }}
      onClick={() => {
        // Container click to detect if pointer events are reaching the toolbox at all
        console.log('AnnotationToolbox container clicked');
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: '0.75rem',
            color: '#95a5a6',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            marginBottom: '0.25rem',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textAlign: 'center'
          }}
        >
          TOOLS
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
          {tools.map(tool => (
            <ToolButton
              key={tool.key}
              tool={tool}
              isActive={tool.key === 'null' ? isLabeledNull : (!isLabeledNull && activeTool === tool.key)}
              onClick={() => tool.key === 'null' ? onMarkAsNull() : handleToolChange(tool.key)}
              disabled={isLabeledNull && (tool.key === 'box' || tool.key === 'polygon' || tool.key === 'smart_polygon')}
            />
          ))}
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: '0.75rem',
            color: '#95a5a6',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            marginBottom: '0.25rem',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textAlign: 'center'
          }}
        >
          VIEW
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
          <ActionButton
            icon={<ZoomInOutlined />}
            tooltip="Increase view scale for closer inspection."
            onClick={handleZoomIn}
          />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '0.25rem 0.125rem',
            background: '#34495e',
            borderRadius: '0.25rem',
            border: '0.0625rem solid #001529',
            width: '3rem'
          }}>
            <Tooltip
              title="Current magnification level. Enter a value or use step controls."
              placement="left"
              overlayStyle={{ zIndex: 100000 }}
              trigger="hover"
            >
              <InputNumber
                value={zoomLevel}
                onChange={handleZoomChange}
                min={25}
                max={500}
                step={25}
                size="small"
                style={{
                  width: '2.75rem',
                  textAlign: 'center',
                  fontSize: '0.75rem'
                }}
                controls={false}
              />
            </Tooltip>
            <Text style={{
              color: '#bdc3c7',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}>
              %
            </Text>
          </div>

          <ActionButton
            icon={<ZoomOutOutlined />}
            tooltip="Decrease view scale to see more of the image."
            onClick={handleZoomOut}
          />
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: '0.75rem',
            color: '#95a5a6',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            marginBottom: '0.25rem',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textAlign: 'center'
          }}
        >
          HISTORY
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
          <ActionButton
            icon={<UndoOutlined />}
            tooltip="Undo: Revert the last change made to the annotations."
            onClick={handleUndo}
            disabled={!canUndo}
          />
          <ActionButton
            icon={<RedoOutlined />}
            tooltip="Redo: Re-apply the last undone change."
            onClick={handleRedo}
            disabled={!canRedo}
          />
        </div>
      </div>

      <Divider style={{ margin: 0, borderColor: '#34495e' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: '0.75rem',
            color: '#95a5a6',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.03125rem',
            marginBottom: '0.25rem',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textAlign: 'center'
          }}
        >
          ACTIONS
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
          <ActionButton
            icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
            tooltip="Delete Image: Permanently remove this image and its annotations from the dataset."
            onClick={handleDeleteImage}
            disabled={false}
            color="#ff4d4f"
          />

          <ActionButton
            icon={<ClearOutlined style={{ color: '#faad14' }} />}
            tooltip="Reset Annotations: Remove all current labels and shapes from this image."
            onClick={handleClear}
            disabled={annotations.length === 0}
            color="#faad14"
          />
        </div>
      </div>
    </div>
  );
};

export default AnnotationToolbox;