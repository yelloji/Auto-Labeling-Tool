/**
 * AnnotationToolbox.js
 * Right sidebar with annotation tools - Professional Roboflow-like design
 */

import React from 'react';
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
  SaveOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

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
  const tools = [
    { key: 'select', icon: DragOutlined, tooltip: 'Select & Move', label: 'Select' },
    { key: 'box', icon: BorderOutlined, tooltip: 'Rectangle Tool', label: 'Box' },
    { key: 'polygon', icon: ExpandOutlined, tooltip: 'Manual Polygon Tool', label: 'Polygon' },
    { key: 'smart_polygon', icon: ThunderboltOutlined, tooltip: 'Smart Polygon - Click to auto-generate polygon around objects', label: 'Smart' }
  ];

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 25, 500);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 25, 25);
    onZoomChange(newZoom);
  };

  const handleZoomChange = (value) => {
    if (value && value >= 25 && value <= 500) {
      onZoomChange(value);
    }
  };

  const ToolButton = ({ tool, isActive, onClick }) => (
    <Tooltip title={tool.tooltip} placement="left">
      <Button
        type={isActive ? 'primary' : 'default'}
        icon={<tool.icon style={{ fontSize: '14px' }} />}
        onClick={onClick}
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
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.target.style.background = '#3498db';
            e.target.style.borderColor = '#3498db';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.target.style.background = '#34495e';
            e.target.style.borderColor = '#001529';
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
    </Tooltip>
  );

  const ActionButton = ({ icon, tooltip, onClick, disabled = false, color = '#595959' }) => (
    <Tooltip title={tooltip} placement="left">
      <Button
        icon={React.cloneElement(icon, { style: { fontSize: '12px' } })}
        onClick={onClick}
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
          if (!disabled) {
            e.target.style.background = '#3498db';
            e.target.style.borderColor = '#3498db';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.target.style.background = '#34495e';
            e.target.style.borderColor = '#001529';
          }
        }}
      />
    </Tooltip>
  );

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
              onClick={() => onToolChange(tool.key)}
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
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ActionButton
            icon={<RedoOutlined />}
            tooltip="Redo"
            onClick={onRedo}
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
            onClick={() => console.log('Delete')}
            color="#ff4d4f"
          />
          <ActionButton
            icon={<ClearOutlined />}
            tooltip="Clear All"
            onClick={onClear}
            color="#ff7875"
          />
          <ActionButton
            icon={<SaveOutlined />}
            tooltip="Save All"
            onClick={onSave}
            color="#52c41a"
          />
        </div>
      </div>
    </div>
  );
};

export default AnnotationToolbox;