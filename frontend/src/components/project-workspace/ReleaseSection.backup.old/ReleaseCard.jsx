import React from 'react';
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Tooltip,
  Dropdown,
  Menu,
  Popconfirm
} from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CalendarOutlined,
  TagOutlined,
  FolderOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import './ReleaseCard.css';

const { Text, Title } = Typography;

const ReleaseCard = ({ 
  release, 
  isSelected, 
  onSelect, 
  onDelete, 
  onExport,
  onRename 
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTaskTypeColor = (taskType) => {
    const colors = {
      'Classification': 'blue',
      'Object Detection': 'green',
      'Segmentation': 'purple',
      'Instance Segmentation': 'orange'
    };
    return colors[taskType] || 'default';
  };

  const getFormatColor = (format) => {
    const colors = {
      'YOLO': 'volcano',
      'COCO': 'geekblue',
      'VOC': 'gold',
      'Pascal': 'lime',
      'JSON': 'cyan'
    };
    return colors[format] || 'default';
  };

  const exportMenu = (
    <Menu
      items={[
        {
          key: 'yolo',
          label: 'Export as YOLO',
          icon: <DownloadOutlined />,
          onClick: () => onExport('yolo')
        },
        {
          key: 'coco',
          label: 'Export as COCO',
          icon: <DownloadOutlined />,
          onClick: () => onExport('coco')
        },
        {
          key: 'voc',
          label: 'Export as VOC',
          icon: <DownloadOutlined />,
          onClick: () => onExport('voc')
        },
        {
          key: 'json',
          label: 'Export as JSON',
          icon: <DownloadOutlined />,
          onClick: () => onExport('json')
        }
      ]}
    />
  );

  const actionMenu = (
    <Menu
      items={[
        {
          key: 'rename',
          label: 'Rename',
          icon: <EditOutlined />,
          onClick: () => onRename && onRename(release.id)
        },
        {
          key: 'export',
          label: 'Export Options',
          icon: <DownloadOutlined />,
          children: [
            {
              key: 'yolo',
              label: 'YOLO Format',
              onClick: () => onExport('yolo')
            },
            {
              key: 'coco',
              label: 'COCO Format',
              onClick: () => onExport('coco')
            },
            {
              key: 'voc',
              label: 'VOC Format',
              onClick: () => onExport('voc')
            },
            {
              key: 'json',
              label: 'JSON Format',
              onClick: () => onExport('json')
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            // Handle delete with confirmation
          }
        }
      ]}
    />
  );

  return (
    <Card
      className={`release-card ${isSelected ? 'release-card-selected' : ''}`}
      onClick={onSelect}
      hoverable
      size="small"
      actions={[
        <Tooltip title="Quick Export">
          <Dropdown overlay={exportMenu} trigger={['click']} placement="topCenter">
            <Button 
              type="text" 
              icon={<DownloadOutlined />} 
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </Tooltip>,
        <Tooltip title="More Actions">
          <Dropdown overlay={actionMenu} trigger={['click']} placement="topCenter">
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </Tooltip>,
        <Popconfirm
          title="Delete this release?"
          description="This action cannot be undone."
          onConfirm={(e) => {
            e.stopPropagation();
            onDelete(release.id);
          }}
          okText="Delete"
          cancelText="Cancel"
          okType="danger"
        >
          <Button 
            type="text" 
            icon={<DeleteOutlined />} 
            danger
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      ]}
    >
      <div className="release-card-header">
        <Title level={5} className="release-card-title">
          {release.name}
        </Title>
        {release.isAugmented && (
          <Tag color="orange" icon={<ExperimentOutlined />}>
            Augmented
          </Tag>
        )}
      </div>

      <div className="release-card-meta">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="release-card-date">
            <CalendarOutlined style={{ marginRight: 4 }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {formatDate(release.createdAt)}
            </Text>
          </div>

          <div className="release-card-stats">
            <Space size="small">
              <div className="release-stat">
                <TagOutlined style={{ marginRight: 2 }} />
                <Text style={{ fontSize: '12px' }}>{release.totalImages}</Text>
              </div>
              <div className="release-stat">
                <FolderOutlined style={{ marginRight: 2 }} />
                <Text style={{ fontSize: '12px' }}>{release.totalClasses}</Text>
              </div>
            </Space>
          </div>

          <div className="release-card-tags">
            <Space size={[4, 4]} wrap>
              <Tag 
                color={getTaskTypeColor(release.taskType)} 
                style={{ fontSize: '10px', margin: 0 }}
              >
                {release.taskType}
              </Tag>
              <Tag 
                color={getFormatColor(release.format)} 
                style={{ fontSize: '10px', margin: 0 }}
              >
                {release.format}
              </Tag>
            </Space>
          </div>

          <div className="release-card-splits">
            <Space size="small">
              <Text style={{ fontSize: '11px' }}>
                <span style={{ color: '#3f8600' }}>T:{release.splits.train}</span>
              </Text>
              <Text style={{ fontSize: '11px' }}>
                <span style={{ color: '#1890ff' }}>V:{release.splits.val}</span>
              </Text>
              <Text style={{ fontSize: '11px' }}>
                <span style={{ color: '#cf1322' }}>T:{release.splits.test}</span>
              </Text>
            </Space>
          </div>
        </Space>
      </div>
    </Card>
  );
};

export default ReleaseCard;