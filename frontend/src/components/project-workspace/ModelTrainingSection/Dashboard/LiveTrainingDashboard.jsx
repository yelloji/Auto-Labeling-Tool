import React from 'react';
import { Card, Progress, Row, Col, Statistic, Tag, Typography } from 'antd';
import { ThunderboltOutlined, DatabaseOutlined, HddOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const LiveTrainingDashboard = ({ metrics }) => {
    const training = metrics?.training || {};
    const validation = metrics?.validation || {};
    const classes = metrics?.classes || [];

    // Calculate epoch progress percentage
    const epochProgress = training.total_epochs
        ? ((training.epoch || 0) / training.total_epochs) * 100
        : 0;

    // Calculate batch progress percentage
    const batchProgress = training.total_batches
        ? ((training.batch || 0) / training.total_batches) * 100
        : 0;

    return (
        <div style={{ padding: 0 }}>
            {/* Section 1: Live Pulse (HUD) - Always visible */}
            <Card
                size="small"
                style={{
                    marginBottom: 12,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none'
                }}
                bodyStyle={{ padding: 12 }}
            >
                <Row gutter={[12, 12]} align="middle">
                    <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                type="circle"
                                percent={Math.round(epochProgress)}
                                width={80}
                                strokeColor="#52c41a"
                                format={() => (
                                    <div style={{ color: '#fff', fontSize: 12 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{training.epoch || 0}</div>
                                        <div style={{ fontSize: 10 }}>/{training.total_epochs || 0}</div>
                                    </div>
                                )}
                            />
                            <div style={{ color: '#fff', marginTop: 4, fontSize: 11 }}>Epoch</div>
                        </div>
                    </Col>
                    <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                percent={Math.round(batchProgress)}
                                strokeColor="#1890ff"
                                showInfo={false}
                                size="small"
                            />
                            <div style={{ color: '#fff', marginTop: 4, fontSize: 11 }}>
                                Batch {training.batch || 0}/{training.total_batches || 0}
                                {training.batch_speed && (
                                    <span style={{ opacity: 0.8 }}>
                                        {' • '}{training.batch_speed.toFixed(1)} it/s
                                        {training.batch_eta && ` • ${Math.round(training.batch_eta)}s left`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Col>
                    <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Tag icon={<HddOutlined />} color="cyan" style={{ fontSize: 14, padding: '4px 12px' }}>
                                {training.gpu_mem || 'N/A'}
                            </Tag>
                            <div style={{ color: '#fff', marginTop: 4, fontSize: 11 }}>GPU Memory</div>
                        </div>
                    </Col>
                </Row>

                {/* Losses Row */}
                <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
                    <Col span={6}>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4 }}>
                            <div style={{ color: '#fff', fontSize: 10 }}>Box</div>
                            <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                {training.box_loss?.toFixed(2) || 'N/A'}
                            </div>
                        </div>
                    </Col>
                    <Col span={6}>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4 }}>
                            <div style={{ color: '#fff', fontSize: 10 }}>Seg</div>
                            <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                {training.seg_loss?.toFixed(2) || 'N/A'}
                            </div>
                        </div>
                    </Col>
                    <Col span={6}>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4 }}>
                            <div style={{ color: '#fff', fontSize: 10 }}>Cls</div>
                            <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                {training.cls_loss?.toFixed(2) || 'N/A'}
                            </div>
                        </div>
                    </Col>
                    <Col span={6}>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4 }}>
                            <div style={{ color: '#fff', fontSize: 10 }}>DFL</div>
                            <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                {training.dfl_loss?.toFixed(2) || 'N/A'}
                            </div>
                        </div>
                    </Col>
                </Row>
            </Card>

            {/* Section 2: Epoch Report (Scorecard) - Always visible */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col span={12}>
                    <Card
                        size="small"
                        title={<span style={{ fontSize: 12 }}>📦 Box Performance</span>}
                        bodyStyle={{ padding: 12, textAlign: 'center' }}
                    >
                        <Statistic
                            value={((validation.box_map50 || 0) * 100).toFixed(1)}
                            suffix="%"
                            valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 'bold' }}
                        />
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            P: {((validation.box_p || 0) * 100).toFixed(1)}% | R: {((validation.box_r || 0) * 100).toFixed(1)}%
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card
                        size="small"
                        title={<span style={{ fontSize: 12 }}>🎭 Mask Performance</span>}
                        bodyStyle={{ padding: 12, textAlign: 'center' }}
                    >
                        <Statistic
                            value={((validation.mask_map50 || 0) * 100).toFixed(1)}
                            suffix="%"
                            valueStyle={{ color: '#722ed1', fontSize: 28, fontWeight: 'bold' }}
                        />
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            P: {((validation.mask_p || 0) * 100).toFixed(1)}% | R: {((validation.mask_r || 0) * 100).toFixed(1)}%
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Section 3: Class Grid (Hero + Class Cards) - Always visible */}
            <Card
                size="small"
                title={<span style={{ fontSize: 12 }}>🏆 Overall Model Score</span>}
                bodyStyle={{ padding: 12 }}
                style={{ marginBottom: 12 }}
            >
                <Row gutter={[12, 12]}>
                    <Col span={12}>
                        <Progress
                            type="dashboard"
                            percent={Math.round((validation.box_map50 || 0) * 100)}
                            strokeColor="#1890ff"
                            format={(percent) => `${percent}%`}
                        />
                        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>Box mAP50</div>
                    </Col>
                    <Col span={12}>
                        <Progress
                            type="dashboard"
                            percent={Math.round((validation.mask_map50 || 0) * 100)}
                            strokeColor="#722ed1"
                            format={(percent) => `${percent}%`}
                        />
                        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>Mask mAP50</div>
                    </Col>
                </Row>
                <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
                    <Col span={12}>
                        <Tag icon={<DatabaseOutlined />} color="blue">Images: {validation.images || 0}</Tag>
                    </Col>
                    <Col span={12}>
                        <Tag icon={<ThunderboltOutlined />} color="green">Instances: {validation.instances || 0}</Tag>
                    </Col>
                </Row>
            </Card>

            {/* Per-Class Cards */}
            {classes.length > 0 && (
                <div>
                    <Title level={5} style={{ fontSize: 12, marginBottom: 8 }}>Per-Class Performance</Title>
                    <Row gutter={[12, 12]}>
                        {classes.map((cls, idx) => (
                            <Col span={24} key={idx}>
                                <Card
                                    size="small"
                                    title={
                                        <span style={{ fontSize: 12 }}>
                                            {cls.class} <Tag color="blue" style={{ marginLeft: 8 }}>{cls.instances}</Tag>
                                        </span>
                                    }
                                    bodyStyle={{ padding: 12 }}
                                >
                                    <Row gutter={[8, 8]}>
                                        <Col span={12}>
                                            <div style={{ fontSize: 10, color: '#888' }}>Box mAP</div>
                                            <Progress
                                                percent={Math.round(cls.box_map50 * 100)}
                                                strokeColor="#1890ff"
                                                size="small"
                                            />
                                        </Col>
                                        <Col span={12}>
                                            <div style={{ fontSize: 10, color: '#888' }}>Mask mAP</div>
                                            <Progress
                                                percent={Math.round(cls.mask_map50 * 100)}
                                                strokeColor="#722ed1"
                                                size="small"
                                            />
                                        </Col>
                                    </Row>
                                    <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>
                                        P: {(cls.box_p * 100).toFixed(1)}% | R: {(cls.box_r * 100).toFixed(1)}%
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}


        </div>
    );
};

export default LiveTrainingDashboard;
