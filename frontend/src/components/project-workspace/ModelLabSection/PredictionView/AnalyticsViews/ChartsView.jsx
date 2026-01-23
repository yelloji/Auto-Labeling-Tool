import React from 'react';
import { Empty, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

/**
 * ChartsView Component
 * 
 * Visual charts tab for data exploration
 * Coming soon - placeholder for now
 */
const ChartsView = ({ experiment }) => {
    return (
        <div className="analytics-tab-content">
            <Empty
                image={<LineChartOutlined style={{ fontSize: '64px', color: '#52c41a' }} />}
                description={
                    <div>
                        <Title level={4}>Visual Charts Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>Confidence distribution histogram</li>
                                <li>Class balance pie chart</li>
                                <li>Size distribution bar chart</li>
                                <li>FP rate comparison charts</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );
};

export default ChartsView;
