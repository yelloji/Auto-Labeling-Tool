import React from 'react';
import { Empty, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

/**
 * ReportView Component
 * 
 * Executive report tab with AI-generated insights
 * Coming soon - placeholder for now
 */
const ReportView = ({ experiment }) => {
    return (
        <div className="analytics-tab-content">
            <Empty
                image={<FileTextOutlined style={{ fontSize: '64px', color: '#722ed1' }} />}
                description={
                    <div>
                        <Title level={4}>Executive Report Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>AI-generated summary narrative</li>
                                <li>Strengths & weaknesses analysis</li>
                                <li>Actionable recommendations</li>
                                <li>Detailed performance breakdown</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );
};

export default ReportView;
