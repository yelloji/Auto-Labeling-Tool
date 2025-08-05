import React, { useState, useEffect } from 'react';
import { Modal, Form, Radio, Select, Button, Card, Row, Col, Divider, Space, Alert, Progress, message } from 'antd';
import { DownloadOutlined, LinkOutlined, ExportOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Option } = Select;

const ExportOptionsModal = ({ visible, onCancel, releaseData, onExport }) => {
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  useEffect(() => {
    if (visible && releaseData) {
      form.setFieldsValue({
        task: 'object_detection',
        format: 'yolo_detection'
      });
    }
  }, [visible, releaseData, form]);

  const taskTypes = {
    object_detection: {
      name: 'Object Detection',
      description: 'Bounding boxes around objects',
      formats: ['yolo_detection', 'coco', 'pascal_voc', 'csv'],
      icon: '📦'
    },
    segmentation: {
      name: 'Instance Segmentation',
      description: 'Pixel-level object masks',
      formats: ['yolo_segmentation', 'coco', 'csv'],
      icon: '🎨'
    }
  };

  const formatDescriptions = {
    yolo_detection: 'YOLO format optimized for object detection with data.yaml',
    yolo_segmentation: 'YOLO format for instance segmentation with polygon coordinates',
    coco: 'COCO JSON format - Industry standard for object detection',
    pascal_voc: 'Pascal VOC XML format - Classic computer vision format',
    csv: 'Comma-separated values format for data analysis'
  };

  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      setExporting(true);
      setExportProgress(0);
      setExportComplete(false);

      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 20;
        });
      }, 500);

      // Call the actual export API
      const exportConfig = {
        ...releaseData,
        taskType: values.task,
        exportFormat: values.format
      };

      // Simulate API call
      setTimeout(() => {
        clearInterval(progressInterval);
        setExportProgress(100);
        setExportComplete(true);
        setDownloadUrl(`/releases/${releaseData?.id}/download?format=${values.format}`);
        message.success('Export completed successfully!');
        
        if (onExport) {
          onExport(exportConfig);
        }
      }, 3000);

    } catch (error) {
      console.error('Export failed:', error);
      setExporting(false);
      message.error('Export failed. Please try again.');
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(window.location.origin + downloadUrl);
      message.success('Download link copied to clipboard!');
    }
  };

  const handleClose = () => {
    setExporting(false);
    setExportProgress(0);
    setExportComplete(false);
    setDownloadUrl(null);
    onCancel();
  };

  const selectedTask = form.getFieldValue('task') || 'object_detection';
  const availableFormats = taskTypes[selectedTask]?.formats || [];

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined />
          <span>Export Release</span>
        </Space>
      }
      visible={visible}
      onCancel={handleClose}
      width={600}
      footer={
        exportComplete ? [
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            Download
          </Button>,
          <Button key="link" icon={<LinkOutlined />} onClick={handleCopyLink}>
            Copy Link
          </Button>,
        ] : [
          <Button key="cancel" onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>,
          <Button 
            key="export" 
            type="primary" 
            icon={exporting ? <LoadingOutlined /> : <ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            disabled={!releaseData}
          >
            {exporting ? 'Exporting...' : 'Start Export'}
          </Button>,
        ]
      }
    >
      {releaseData && (
        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed' }}>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#1890ff' }}>
                  {releaseData.totalImages || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Total Images</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#52c41a' }}>
                  {releaseData.totalClasses || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Classes</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#722ed1' }}>
                  {releaseData.transformationsCount || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Transformations</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {exporting && (
        <Alert
          message="Exporting Release"
          description={
            <div style={{ marginTop: 8 }}>
              <Progress 
                percent={Math.round(exportProgress)} 
                status={exportComplete ? 'success' : 'active'}
                strokeColor={exportComplete ? '#52c41a' : '#1890ff'}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                {exportProgress < 30 && 'Preparing dataset...'}
                {exportProgress >= 30 && exportProgress < 60 && 'Applying transformations...'}
                {exportProgress >= 60 && exportProgress < 90 && 'Generating export files...'}
                {exportProgress >= 90 && !exportComplete && 'Finalizing export...'}
                {exportComplete && 'Export completed successfully!'}
              </div>
            </div>
          }
          type={exportComplete ? 'success' : 'info'}
          showIcon
          icon={exportComplete ? <CheckCircleOutlined /> : <LoadingOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item 
          label="Task Type" 
          name="task"
          rules={[{ required: true, message: 'Please select a task type' }]}
        >
          <Radio.Group style={{ width: '100%' }}>
            {Object.entries(taskTypes).map(([key, task]) => (
              <Card 
                key={key}
                size="small" 
                style={{ 
                  marginBottom: 8,
                  border: form.getFieldValue('task') === key ? '2px solid #1890ff' : '1px solid #d9d9d9'
                }}
              >
                <Radio value={key} style={{ width: '100%' }}>
                  <Space>
                    <span style={{ fontSize: '16px' }}>{task.icon}</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{task.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{task.description}</div>
                    </div>
                  </Space>
                </Radio>
              </Card>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item 
          label="Export Format" 
          name="format"
          rules={[{ required: true, message: 'Please select an export format' }]}
        >
          <Select placeholder="Select export format" style={{ width: '100%' }}>
            {availableFormats.map(format => (
              <Option key={format} value={format}>
                <div>
                  <div style={{ fontWeight: 500 }}>{format.toUpperCase()}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {formatDescriptions[format]}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ExportOptionsModal;





