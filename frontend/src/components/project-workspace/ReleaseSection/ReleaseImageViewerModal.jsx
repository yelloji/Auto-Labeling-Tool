import React, { useState } from 'react';
import { Modal, Image, Button, Space, Typography, Tag, Divider } from 'antd';
import { LeftOutlined, RightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../../config';

const { Text, Title } = Typography;

const ReleaseImageViewerModal = ({
  visible,
  onClose,
  images,
  initialIndex,
  releaseId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  if (!visible || !images[currentIndex]) return null;

  const currentImage = images[currentIndex];
  const { filename, split, fullImageUrl, hasAnnotations, annotationFile } = currentImage;
  const annotationCount = hasAnnotations ? 'Available' : 'None';

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      width="90%"
      bodyStyle={{ padding: 0 }}
      centered
    >
      <div style={{ position: 'relative', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Image
            src={fullImageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            preview={false}
          />
          {/* Annotation overlays would go here, similar to thumbnail logic */}
          {/* For simplicity, assuming overlay logic is implemented separately */}
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>{filename}</Title>
          <Tag color="blue">{split.toUpperCase()}</Tag>
        </div>
        <Button
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
          icon={<LeftOutlined />}
          onClick={handlePrev}
        />
        <Button
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
          icon={<RightOutlined />}
          onClick={handleNext}
        />
        <div style={{ padding: 16, background: '#f0f2f5' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={5}><InfoCircleOutlined /> Metadata</Title>
            <Divider style={{ margin: '8px 0' }} />
            <Text><strong>Split:</strong> {split}</Text>
            <Text><strong>Filename:</strong> {filename}</Text>
            <Text><strong>Annotations:</strong> {annotationCount}</Text>
            {hasAnnotations && annotationFile && (
              <Text><strong>Annotation File:</strong> {annotationFile}</Text>
            )}
            {/* Add more metadata as needed */}
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default ReleaseImageViewerModal;