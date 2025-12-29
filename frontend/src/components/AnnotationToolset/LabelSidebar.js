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
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

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

  // Log sidebar initialization
  React.useEffect(() => {
    logInfo('app.frontend.ui', 'label_sidebar_initialized', 'Label sidebar initialized', {
      projectLabelsCount: projectLabels.length,
      imageAnnotationsCount: imageAnnotations.length,
      selectedLabel,
      hiddenLabelsCount: hiddenLabels.length
    });
  }, [projectLabels.length, imageAnnotations.length, selectedLabel, hiddenLabels.length]);

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
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: isSelected ? '0.125rem solid #3498db' : '0.0625rem solid #002140',
          backgroundColor: isSelected ? '#002140' : '#001529',
          cursor: 'pointer',
          marginBottom: '0.5rem',
          opacity: isHidden ? 0.4 : 1,
          transition: 'all 0.2s ease',
          boxShadow: isSelected ? '0 0.125rem 0.5rem rgba(52, 152, 219, 0.15)' : '0 0.0625rem 0.125rem rgba(0,0,0,0.05)'
        }}
        onClick={() => {
          onLabelSelect?.(label.id);
          logUserClick('LabelSidebar', 'SelectLabel', label.name);
          logInfo('app.frontend.interactions', 'label_selected', 'Label selected in sidebar', {
            labelId: label.id,
            labelName: label.name,
            imageCount: label.imageCount,
            projectCount: label.projectCount
          });
        }}
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
                width: '1rem',
                height: '1rem',
                borderRadius: '0.25rem',
                backgroundColor: label.color,
                border: '0.0625rem solid rgba(0,0,0,0.1)',
                boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.1)'
              }}
            />
            <Text
              strong={isActive}
              style={{
                color: isActive ? '#bdc3c7' : '#95a5a6',
                fontSize: '1rem',
                maxWidth: '7.5rem',
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
                fontSize: '0.875rem',
                minWidth: '1.125rem',
                height: '1.125rem',
                lineHeight: '1.125rem'
              }}
              title={`${label.imageCount} annotations in this image`}
            />

            {/* Project count badge - always show project count */}
            <Badge
              count={`${label.projectCount}P`}
              style={{
                backgroundColor: '#3498db',
                color: '#fff',
                fontSize: '0.875rem',
                minWidth: '1.5rem',
                height: '1.125rem',
                lineHeight: '1.125rem'
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
                  logUserClick('LabelSidebar', 'ToggleVisibility', label.name);
                  logInfo('app.frontend.interactions', 'label_visibility_toggled', 'Label visibility toggled', {
                    labelId: label.id,
                    labelName: label.name,
                    isHidden: !isHidden // Log the new state
                  });
                }}
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  color: isHidden ? '#ff4d4f' : '#52c41a',
                  padding: 0
                }}
              />
            </Tooltip>
          </Space>
        </div>

        <div style={{
          fontSize: '1rem',
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
        padding: '1rem',
        borderBottom: '0.0625rem solid #002140',
        background: '#001529'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem'
        }}>
          <Space>
            <TagOutlined style={{ color: '#3498db', fontSize: '1.25rem' }} />
            <Title level={5} style={{ margin: 0, color: '#bdc3c7', fontSize: '1.125rem', whiteSpace: 'nowrap' }}>
              Labels
            </Title>
          </Space>

          {onAddLabel && (
            <Tooltip title="Add new label">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  onAddLabel();
                  logUserClick('LabelSidebar', 'AddLabel', 'Add new label button clicked');
                  logInfo('app.frontend.interactions', 'add_label_triggered', 'Add new label triggered from sidebar', {
                    currentLabelsCount: projectLabels.length
                  });
                }}
                style={{
                  borderRadius: '0.375rem',
                  height: '1.75rem'
                }}
              >
                Add
              </Button>
            </Tooltip>
          )}
        </div>

        <Text style={{ fontSize: '0.875rem', color: '#95a5a6' }}>
          {labelsWithCounts.length > 0 ? (
            <>
              {labelsWithCounts.filter(l => l.imageCount > 0).length} used in this image
            </>
          ) : (
            'No labels yet'
          )}
        </Text>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {!projectLabels || projectLabels.length === 0 ? (
          renderEmptyState()
        ) : (
          <div>
            {/* Header for all project labels */}
            <Text
              style={{
                fontSize: '0.875rem',
                color: '#3498db',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.03125rem',
                marginBottom: '0.5rem',
                display: 'block'
              }}
            >
              Project Labels ({labelsWithCounts.length})
            </Text>

            {/* Active labels - used in this image */}
            {labelsWithCounts.filter(l => l.imageCount > 0).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Text
                  style={{
                    fontSize: '0.8125rem',
                    color: '#8c8c8c',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03125rem',
                    marginBottom: '0.5rem',
                    display: 'block',
                    paddingLeft: '0.5rem'
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

            {/* Hidden: Other available labels section to save space */}
          </div>
        )}
      </div>

      {/* Footer - Keyboard Shortcuts */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '0.0625rem solid #002140',
        background: '#001529'
      }}>
        <Text style={{ fontSize: '0.9375rem', color: '#1890ff', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
          ⌨️ Keyboard Shortcuts
        </Text>
        <Text style={{ fontSize: '0.875rem', color: '#95a5a6', lineHeight: '1.4' }}>
          <strong>Ctrl+Z:</strong> Undo | <strong>Ctrl+Y:</strong> Redo<br />
          <strong>Shift+Z:</strong> Undo point | <strong>Shift+Y:</strong> Redo point<br />
          <strong>Delete:</strong> Remove | <strong>Escape:</strong> Cancel<br />
          <span style={{ color: '#ffa940', fontSize: '0.8125rem' }}>⚠️ Undo works after polygon completion</span>
        </Text>
      </div>
    </div>
  );
};

export default LabelSidebar;
