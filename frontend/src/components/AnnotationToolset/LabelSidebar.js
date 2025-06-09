/**
 * LabelSidebar.js
 * Professional label management sidebar - Roboflow-like design
 */

import React from 'react';
import { Typography, Space, Button, Tooltip, Badge } from 'antd';
import {
  TagOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

const LabelSidebar = ({
  projectLabels = [],              // ✅ All global labels
  imageAnnotations = [],          // ✅ Annotations for current image
  selectedLabel = null,
  hiddenLabels = [],
  onLabelSelect,
  onLabelHighlight,
  onLabelVisibilityToggle,
  onAddLabel,
  style = {}
}) => {

  // ✅ Map project labels to per-image usage count
  const labelsWithCounts = projectLabels.map(label => {
    const count = imageAnnotations.filter(ann => ann.class_name === label.name).length;
    return { ...label, count };
  });

  const renderEmptyState = () => (
    <div style={{
      padding: '32px 16px',
      textAlign: 'center',
      color: '#95a5a6'
    }}>
      <TagOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#7f8c8d' }} />
      <Title level={5} style={{ color: '#bdc3c7', marginBottom: '8px' }}>
        No labels in this image
      </Title>
      <Text style={{ fontSize: '12px', color: '#95a5a6' }}>
        Draw shapes to create annotations
      </Text>
    </div>
  );

  const renderLabelItem = (label) => {
    const isSelected = selectedLabel === label.id;
    const isHidden = hiddenLabels.includes(label.id);
    const isActive = label.count > 0;

    return (
      <div
        key={label.id}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: isSelected ? '2px solid #3498db' : '1px solid #002140',
          backgroundColor: isSelected ? '#002140' : '#001529',
          cursor: 'pointer',
          marginBottom: '8px',
          opacity: isHidden ? 0.4 : 1,
          transition: 'all 0.2s ease',
          boxShadow: isSelected ? '0 2px 8px rgba(52, 152, 219, 0.15)' : '0 1px 2px rgba(0,0,0,0.05)'
        }}
        onClick={() => onLabelSelect?.(label.id)}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.target.style.backgroundColor = '#002140';
            e.target.style.borderColor = '#3498db';
          }
          onLabelHighlight?.(label.id, true);
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.target.style.backgroundColor = '#001529';
            e.target.style.borderColor = '#002140';
          }
          onLabelHighlight?.(label.id, false);
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <Space size={8}>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: label.color,
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            />
            <Text
              strong={isActive}
              style={{
                color: isActive ? '#bdc3c7' : '#95a5a6',
                fontSize: '14px',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={label.name}
            >
              {label.name}
            </Text>
          </Space>

          <Space size={4}>
            <Badge
              count={label.count}
              style={{
                backgroundColor: isActive ? '#52c41a' : '#d9d9d9',
                color: '#fff',
                fontSize: '10px',
                minWidth: '18px',
                height: '18px',
                lineHeight: '18px'
              }}
            />
            <Tooltip title={isHidden ? 'Show annotations' : 'Hide annotations'}>
              <Button
                type="text"
                size="small"
                icon={isHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onLabelVisibilityToggle?.(label.id);
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  color: isHidden ? '#ff4d4f' : '#52c41a',
                  padding: 0
                }}
              />
            </Tooltip>
          </Space>
        </div>

        {isActive && (
          <div style={{
            fontSize: '11px',
            color: '#8c8c8c',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              {label.count} annotation{label.count !== 1 ? 's' : ''}
            </span>
            {isSelected && (
              <Text style={{ fontSize: '10px', color: '#1890ff' }}>
                ● Selected
              </Text>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#001529',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #002140',
        background: '#001529'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <Space>
            <TagOutlined style={{ color: '#3498db', fontSize: '16px' }} />
            <Title level={5} style={{ margin: 0, color: '#bdc3c7' }}>
              Labels
            </Title>
          </Space>

          {onAddLabel && (
            <Tooltip title="Add new label">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={onAddLabel}
                style={{
                  borderRadius: '6px',
                  height: '28px'
                }}
              >
                Add
              </Button>
            </Tooltip>
          )}
        </div>

        <Text style={{ fontSize: '12px', color: '#95a5a6' }}>
          {labelsWithCounts.length > 0 ? (
            <>
              {labelsWithCounts.filter(l => l.count > 0).length} of {labelsWithCounts.length} labels used
            </>
          ) : (
            'No labels created yet'
          )}
        </Text>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'auto'
      }}>
        {labelsWithCounts.length === 0 ? (
          renderEmptyState()
        ) : (
          <div>
            {/* Active labels */}
            {labelsWithCounts.filter(l => l.count > 0).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Text
                  style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                    display: 'block'
                  }}
                >
                  Used in this image
                </Text>
                {labelsWithCounts
                  .filter(l => l.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map(renderLabelItem)
                }
              </div>
            )}

            {/* Unused labels */}
            {labelsWithCounts.filter(l => l.count === 0).length > 0 && (
              <div>
                <Text
                  style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                    display: 'block'
                  }}
                >
                  Available labels
                </Text>
                {labelsWithCounts
                  .filter(l => l.count === 0)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(renderLabelItem)
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #002140',
        background: '#001529'
      }}>
        <Text style={{ fontSize: '11px', color: '#95a5a6' }}>
          💡 Click labels to highlight annotations
        </Text>
      </div>
    </div>
  );
};

export default LabelSidebar;
