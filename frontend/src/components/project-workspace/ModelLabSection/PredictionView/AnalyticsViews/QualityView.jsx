import React from 'react';
import { Empty, Typography, Card, Row, Col, Statistic, Progress } from 'antd';
import { TrophyOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

/**
 * QualityView Component
 * 
 * Quality analysis tab showing precision, recall, FP analysis, etc.
 * Coming soon - placeholder for now
 */
const QualityView = ({ experiment }) => {
    return (
        <div className="analytics-tab-content">
            <Empty
                image={<TrophyOutlined style={{ fontSize: '64px', color: '#1890ff' }} />}
                description={
                    <div>
                        <Title level={4}>Quality Analysis Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>Precision & Recall metrics</li>
                                <li>False Positive analysis by class and size</li>
                                <li>Missed detections breakdown</li>
                                <li>Human verification progress</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );
};

export default QualityView;
