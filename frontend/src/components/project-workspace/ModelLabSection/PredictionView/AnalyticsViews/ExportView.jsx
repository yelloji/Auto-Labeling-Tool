import React from 'react';
import { Empty, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

/**
 * ExportView Component
 * 
 * Export and sharing options tab
 * Coming soon - placeholder for now
 */
const ExportView = ({ experiment }) => {
    return (
        <div className="analytics-tab-content">
            <Empty
                image={<DownloadOutlined style={{ fontSize: '64px', color: '#faad14' }} />}
                description={
                    <div>
                        <Title level={4}>Export Options Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will offer:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>PDF report generation</li>
                                <li>CSV data export</li>
                                <li>Chart pack download</li>
                                <li>Share link creation</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );
};

export default ExportView;
