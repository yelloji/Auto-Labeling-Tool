import React from 'react';
import {
  Card,
  Typography,
  Progress,
  Dropdown,
  Tag,
  Space,
  Button
} from 'antd';
import {
  ClockCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const DatasetCard = ({ 
  dataset, 
  status, 
  onClick, 
  onRename, 
  onMoveToUnassigned, 
  onMoveToAnnotating, 
  onMoveToDataset, 
  onDelete 
}) => {
  // Get status icon based on dataset status
  const getStatusIcon = () => {
    switch (status) {
      case 'unassigned': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'annotating': return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default: return <DatabaseOutlined />;
    }
  };

  // Calculate progress percentage
  const getProgressPercent = () => {
    if (dataset.total_images === 0) return 0;
    
    // For datasets in the annotating section, we need to ensure we have the latest count
    if (status === 'annotating' || status === 'unassigned') {
      return Math.round((dataset.labeled_images / dataset.total_images) * 100);
    }
    
    // For completed datasets, always show 100%
    if (status === 'completed') {
      return 100;
    }
    
    return Math.round((dataset.labeled_images / dataset.total_images) * 100);
  };

  // Dropdown menu items for three dots - different based on status
  const getMenuItems = () => {
    const baseItems = [
      {
        key: 'rename',
        label: 'Rename',
        icon: <EditOutlined />,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          onRename(dataset);
        }
      }
    ];

    if (status === 'annotating') {
      // Always allow moving back to unassigned
      baseItems.push({
        key: 'move-to-unassigned',
        label: 'Move to Unassigned',
        icon: <ClockCircleOutlined />,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          onMoveToUnassigned(dataset);
        }
      });

      // Only allow moving to dataset when ALL images are labeled
      const isFullyLabeled = dataset.labeled_images === dataset.total_images && dataset.total_images > 0;
      if (isFullyLabeled) {
        baseItems.push({
          key: 'move-to-dataset',
          label: 'Move to Dataset',
          icon: <CheckCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToDataset(dataset);
          }
        });
      }
    } else if (status === 'completed') {
      baseItems.push(
        {
          key: 'move-to-unassigned',
          label: 'Move to Unassigned',
          icon: <ClockCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToUnassigned(dataset);
          }
        },
        {
          key: 'move-to-annotating',
          label: 'Move to Annotating',
          icon: <PlayCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToAnnotating(dataset);
          }
        }
      );
    }

    baseItems.push({
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (e) => {
        e?.domEvent?.stopPropagation();
        onDelete(dataset);
      }
    });

    return baseItems;
  };

  // The progress percentage
  const progressPercent = getProgressPercent();

  return (
    <Card
      key={dataset.id}
      size="small"
      style={{ 
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '1px solid #f0f0f0',
        position: 'relative',
        borderLeft: status === 'unassigned' 
          ? '3px solid #faad14' 
          : status === 'annotating' 
            ? '3px solid #1890ff' 
            : '3px solid #52c41a'
      }}
      hoverable
      bodyStyle={{ padding: '12px' }}
      onClick={() => onClick(dataset)}
    >
      {/* Three dots button in top right corner */}
      <div style={{ 
        position: 'absolute', 
        top: '8px', 
        right: '8px', 
        zIndex: 10 
      }}>
        <Dropdown
          menu={{ items: getMenuItems() }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button 
            type="text" 
            icon={<MoreOutlined />} 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{ 
              border: 'none',
              boxShadow: 'none',
              padding: '4px'
            }}
          />
        </Dropdown>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', paddingRight: '24px' }}>
        {getStatusIcon()}
        <Text 
          strong 
          style={{ 
            marginLeft: '8px', 
            fontSize: '14px',
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
          }}
        >
          {dataset.name}
        </Text>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {dataset.total_images} images
        </Text>
        {dataset.tags && dataset.tags.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <Space size={[0, 4]} wrap>
              {dataset.tags.map((tag, index) => (
                <Tag key={index} style={{ fontSize: '10px', padding: '0 4px' }}>
                  {tag}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '8px' }}>
        {(status === 'annotating' || status === 'unassigned') && (
          <div style={{ marginTop: '4px' }}>
            <Progress 
              percent={progressPercent} 
              size="small" 
              status={progressPercent === 100 ? 'success' : 'active'}
            />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {dataset.labeled_images}/{dataset.total_images} labeled
              {dataset.labeled_images < dataset.total_images && status === 'annotating' && (
                <Text type="warning" style={{ fontSize: '10px', display: 'block' }}>
                  Label all images to move to dataset
                </Text>
              )}
            </Text>
          </div>
        )}
        {status === 'completed' && (
          <div style={{ marginTop: '4px' }}>
            <Progress 
              percent={100} 
              size="small" 
              status="success"
            />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {dataset.total_images}/{dataset.total_images} labeled
            </Text>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {new Date(dataset.created_at).toLocaleDateString()}
        </Text>
      </div>
    </Card>
  );
};

export default DatasetCard;