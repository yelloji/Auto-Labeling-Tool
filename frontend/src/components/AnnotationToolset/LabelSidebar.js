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
    // Count how many annotations in the current image use this label
    const imageCount = imageAnnotations.filter(ann => 
      (ann.class_name && ann.class_name.toLowerCase() === label.name.toLowerCase()) || 
      (ann.label && ann.label.toLowerCase() === label.name.toLowerCase())
    ).length;
    
    // Use the image count for display, but keep the project-wide count for reference
    return { 
      ...label, 
      imageCount, 
      projectCount: label.projectCount || label.count || 0,
      // If the label is used in this image, show the image count, otherwise show 0
      count: imageCount
    };
  });

  const renderEmptyState = () => (
    <div style={{
      padding: '32px 16px',
      textAlign: 'center',
      color: '#95a5a6'
    }}>
      <TagOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#7f8c8d' }} />
      <Title level={5} style={{ color: '#bdc3c7', marginBottom: '8px' }}>
        {projectLabels && projectLabels.length > 0 
          ? 'Available Labels' 
          : 'No labels in this project'}
      </Title>
      <Text style={{ fontSize: '12px', color: '#95a5a6' }}>
        {projectLabels && projectLabels.length > 0 
          ? 'Select a label to use for annotations' 
          : 'Draw shapes to create annotations'}
      </Text>
    </div>
  );

  const renderLabelItem = (label) => {
    const isSelected = selectedLabel === label.id;
    const isHidden = hiddenLabels.includes(label.id);
    const isActive = label.imageCount > 0;

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
            {/* Image count badge */}
            <Badge
              count={label.imageCount}
              style={{
                backgroundColor: isActive ? '#52c41a' : '#d9d9d9',
                color: '#fff',
                fontSize: '10px',
                minWidth: '18px',
                height: '18px',
                lineHeight: '18px'
              }}
              title={`${label.imageCount} annotations in this image`}
            />
            
            {/* Project count badge - always show project count */}
            <Badge
              count={`${label.projectCount}P`}
              style={{
                backgroundColor: '#3498db',
                color: '#fff',
                fontSize: '10px',
                minWidth: '24px',
                height: '18px',
                lineHeight: '18px'
              }}
              title={`${label.projectCount} annotations in the project`}
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

        <div style={{
          fontSize: '11px',
          color: '#8c8c8c',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            {isActive ? 
              `${label.imageCount} annotation${label.imageCount !== 1 ? 's' : ''} in this image` : 
              `${label.projectCount} annotation${label.projectCount !== 1 ? 's' : ''} in project`
            }
          </span>
          {isSelected && (
            <Text style={{ fontSize: '10px', color: '#1890ff' }}>
              ● Selected
            </Text>
          )}
        </div>
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
              {labelsWithCounts.filter(l => l.imageCount > 0).length} of {labelsWithCounts.length} labels used
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
        {!projectLabels || projectLabels.length === 0 ? (
          renderEmptyState()
        ) : (
          <div>
            {/* Header for all project labels */}
            <Text
              style={{
                fontSize: '11px',
                color: '#3498db',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
                display: 'block'
              }}
            >
              All Project Labels ({labelsWithCounts.length})
            </Text>

            {/* Active labels - used in this image */}
            {labelsWithCounts.filter(l => l.imageCount > 0).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Text
                  style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                    display: 'block',
                    paddingLeft: '8px'
                  }}
                >
                  Used in this image ({labelsWithCounts.filter(l => l.imageCount > 0).length})
                </Text>
                {labelsWithCounts
                  .filter(l => l.imageCount > 0)
                  .sort((a, b) => b.imageCount - a.imageCount)
                  .map(renderLabelItem)
                }
              </div>
            )}

            {/* Project labels - available for use */}
            <div>
              <Text
                style={{
                  fontSize: '11px',
                  color: '#8c8c8c',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                  display: 'block',
                  paddingLeft: '8px'
                }}
              >
                Other available labels ({labelsWithCounts.filter(l => l.imageCount === 0).length})
              </Text>
              {labelsWithCounts
                .filter(l => l.imageCount === 0)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(renderLabelItem)
              }
            </div>
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
          💡 Click labels to select for new annotations
        </Text>
        <br />
        <Text style={{ fontSize: '11px', color: '#95a5a6' }}>
          🔍 Labels with green badges are used in this image
        </Text>
      </div>
    </div>
  );
};

export default LabelSidebar;
