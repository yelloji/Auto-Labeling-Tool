import React from 'react';
import { Card, Progress, Row, Col, Statistic, Tag, Typography, Tooltip } from 'antd';
import { ThunderboltOutlined, DatabaseOutlined, HddOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const LiveTrainingDashboard = ({ metrics, status }) => {
    const training = metrics?.training || {};
    const validation = metrics?.validation || {};
    const classes = metrics?.classes || [];

    // Detect task type: segmentation has seg_loss and mask metrics, detection doesn't
    const isSegmentation = training.seg_loss !== undefined || validation.mask_p !== undefined;

    // Calculate F1 Scores
    const boxF1 = (validation.box_p && validation.box_r)
        ? (2 * validation.box_p * validation.box_r) / (validation.box_p + validation.box_r)
        : 0;
    const maskF1 = (validation.mask_p && validation.mask_r)
        ? (2 * validation.mask_p * validation.mask_r) / (validation.mask_p + validation.mask_r)
        : 0;

    // Hide dashboard only if metrics object is completely empty
    if (!metrics || (Object.keys(training).length === 0 && Object.keys(validation).length === 0)) {
        return null;
    }

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
                <Row gutter={[6, 6]} align="middle">
                    <Col xs={24} sm={24} lg={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                type="circle"
                                percent={Math.round(epochProgress)}
                                width={window.innerWidth < 1400 ? 60 : 80}
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
                    <Col xs={24} sm={24} lg={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                percent={Math.round(batchProgress)}
                                strokeColor="#1890ff"
                                showInfo={false}
                                size="small"
                            />
                            <div style={{ color: '#fff', marginTop: 4, fontSize: window.innerWidth < 1400 ? 9 : 11 }}>
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
                    <Col xs={24} sm={24} lg={8}>
                        <div style={{ textAlign: 'center' }}>
                            <Tag icon={<HddOutlined />} color="cyan" style={{ fontSize: window.innerWidth < 1400 ? 11 : 14, padding: window.innerWidth < 1400 ? '2px 6px' : '4px 12px' }}>
                                {training.gpu_mem || 'N/A'}
                            </Tag>
                            <div style={{ color: '#fff', marginTop: 4, fontSize: 11 }}>GPU Memory</div>
                        </div>
                    </Col>
                </Row>

                {/* Losses Row */}
                <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
                    <Col span={isSegmentation ? 6 : 8}>
                        <Tooltip title="Bounding Box Loss">
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                <div style={{ color: '#fff', fontSize: 10 }}>Box Loss</div>
                                <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                    {training.box_loss?.toFixed(2) || 'N/A'}
                                </div>
                            </div>
                        </Tooltip>
                    </Col>
                    {isSegmentation && (
                        <Col span={6}>
                            <Tooltip title="Segmentation Loss">
                                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                    <div style={{ color: '#fff', fontSize: 10 }}>Seg Loss</div>
                                    <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                        {training.seg_loss?.toFixed(2) || 'N/A'}
                                    </div>
                                </div>
                            </Tooltip>
                        </Col>
                    )}
                    <Col span={isSegmentation ? 6 : 8}>
                        <Tooltip title="Classification Loss">
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                <div style={{ color: '#fff', fontSize: 10 }}>Cls Loss</div>
                                <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                    {training.cls_loss?.toFixed(2) || 'N/A'}
                                </div>
                            </div>
                        </Tooltip>
                    </Col>
                    <Col span={isSegmentation ? 6 : 8}>
                        <Tooltip title="Distribution Focal Loss">
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                <div style={{ color: '#fff', fontSize: 10 }}>DFL Loss</div>
                                <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                    {training.dfl_loss?.toFixed(2) || 'N/A'}
                                </div>
                            </div>
                        </Tooltip>
                    </Col>
                </Row>

                {/* Instances & Size Row */}
                <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                    <Col span={isSegmentation ? 12 : 24}>
                        <Tooltip title="Number of labeled objects in current batch">
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                <div style={{ color: '#fff', fontSize: 10 }}>Instances</div>
                                <div style={{ color: '#00d9ff', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                    {training.instances || 'N/A'}
                                </div>
                            </div>
                        </Tooltip>
                    </Col>
                    <Col span={isSegmentation ? 12 : 24}>
                        <Tooltip title="Training image resolution (e.g., 640x640)">
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 4, cursor: 'help' }}>
                                <div style={{ color: '#fff', fontSize: 10 }}>Size</div>
                                <div style={{ color: '#00d9ff', fontWeight: 'bold', fontSize: 14, fontFamily: 'monospace' }}>
                                    {training.img_size || 'N/A'}
                                </div>
                            </div>
                        </Tooltip>
                    </Col>
                </Row>
            </Card>

            {/* Section 2: Validation Results - Beautiful Header + Cards */}
            {/* Validation Header Card */}
            <Card
                size="small"
                style={{
                    marginBottom: 12,
                    background: '#f5f7fa',
                    border: '1px solid #e8e8e8',
                    borderRadius: 4,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
                bodyStyle={{ padding: 12 }}
            >
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13, color: '#333', whiteSpace: 'nowrap' }}>
                        {status === 'completed'
                            ? "✨ FINAL VALIDATION RESULTS"
                            : `✨ VALIDATION RESULTS (Epoch ${Math.max(0, (training.epoch || 1) - 1)})`}
                    </Text>
                </div>
                <Row gutter={[8, 8]}>
                    <Col span={12}>
                        <Tooltip title="Total validation images">
                            <div style={{ textAlign: 'center', borderRadius: 4, padding: 6, cursor: 'help' }}>
                                <Tag icon={<DatabaseOutlined />} color="blue">Images: {validation.images || 0}</Tag>
                            </div>
                        </Tooltip>
                    </Col>
                    <Col span={12}>
                        <Tooltip title="Total labeled objects in validation">
                            <div style={{ textAlign: 'center', borderRadius: 4, padding: 6, cursor: 'help' }}>
                                <Tag icon={<ThunderboltOutlined />} color="green">Instances: {validation.instances || 0}</Tag>
                            </div>
                        </Tooltip>
                    </Col>
                </Row>
            </Card>

            {/* Box & Mask Performance Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                {/* Box Detection Card */}
                <Col span={isSegmentation ? 12 : 24}>
                    <Card
                        size="small"
                        title={<span style={{ fontSize: 11 }}>📦 BOX DETECTION</span>}
                        style={{
                            background: '#f8f9fa',
                            borderTop: '2px solid #1890ff',
                            borderRadius: 4,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                        }}
                        bodyStyle={{ padding: 12 }}
                    >
                        {/* Precision */}
                        <Tooltip title="Correct predictions (avoids false alarms)">
                            <div style={{ marginBottom: 12, cursor: 'help' }}>
                                <Text style={{ fontSize: 11, color: '#666' }}>Precision</Text>
                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>
                                    {((validation.box_p || 0) * 100).toFixed(1)}%
                                </div>
                                <Progress
                                    percent={Math.round((validation.box_p || 0) * 100)}
                                    strokeColor="#52c41a"
                                    showInfo={false}
                                    size="small"
                                />
                            </div>
                        </Tooltip>

                        {/* Recall */}
                        <Tooltip title="Objects detected (catches all defects)">
                            <div style={{ marginBottom: 12, cursor: 'help' }}>
                                <Text style={{ fontSize: 11, color: '#666' }}>Recall</Text>
                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>
                                    {((validation.box_r || 0) * 100).toFixed(1)}%
                                </div>
                                <Progress
                                    percent={Math.round((validation.box_r || 0) * 100)}
                                    strokeColor="#1890ff"
                                    showInfo={false}
                                    size="small"
                                />
                            </div>
                        </Tooltip>

                        {/* mAP50 */}
                        <Tooltip title="Overall accuracy at 50% overlap">
                            <div style={{ marginBottom: 8, cursor: 'help' }}>
                                <Text style={{ fontSize: 11, color: '#666' }}>mAP50</Text>
                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>
                                    {(validation.box_map50 || 0).toFixed(3)}
                                </div>
                            </div>
                        </Tooltip>

                        {/* mAP50-95 */}
                        <Tooltip title="Strict accuracy across multiple thresholds">
                            <div style={{ cursor: 'help' }}>
                                <Text style={{ fontSize: 11, color: '#666' }}>mAP50-95</Text>
                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#faad14' }}>
                                    {(validation.box_map50_95 || 0).toFixed(3)}
                                </div>
                            </div>
                        </Tooltip>
                    </Card>
                </Col>

                {/* Mask Segmentation Card - Only for segmentation tasks */}
                {isSegmentation && (
                    <Col span={12}>
                        <Card
                            size="small"
                            title={<span style={{ fontSize: 11 }}>🎭 MASK SEGMENTATION</span>}
                            style={{
                                background: '#f8f9fa',
                                borderTop: '2px solid #722ed1',
                                borderRadius: 4,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                            }}
                            bodyStyle={{ padding: 12 }}
                        >
                            {/* Precision */}
                            <Tooltip title="Correct predictions (avoids false alarms)">
                                <div style={{ marginBottom: 12, cursor: 'help' }}>
                                    <Text style={{ fontSize: 11, color: '#666' }}>Precision</Text>
                                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>
                                        {((validation.mask_p || 0) * 100).toFixed(1)}%
                                    </div>
                                    <Progress
                                        percent={Math.round((validation.mask_p || 0) * 100)}
                                        strokeColor="#52c41a"
                                        showInfo={false}
                                        size="small"
                                    />
                                </div>
                            </Tooltip>

                            {/* Recall */}
                            <Tooltip title="Objects detected (catches all defects)">
                                <div style={{ marginBottom: 12, cursor: 'help' }}>
                                    <Text style={{ fontSize: 11, color: '#666' }}>Recall</Text>
                                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>
                                        {((validation.mask_r || 0) * 100).toFixed(1)}%
                                    </div>
                                    <Progress
                                        percent={Math.round((validation.mask_r || 0) * 100)}
                                        strokeColor="#1890ff"
                                        showInfo={false}
                                        size="small"
                                    />
                                </div>
                            </Tooltip>

                            {/* mAP50 */}
                            <Tooltip title="Overall accuracy at 50% overlap">
                                <div style={{ marginBottom: 8, cursor: 'help' }}>
                                    <Text style={{ fontSize: 11, color: '#666' }}>mAP50</Text>
                                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>
                                        {(validation.mask_map50 || 0).toFixed(3)}
                                    </div>
                                </div>
                            </Tooltip>

                            {/* mAP50-95 */}
                            <Tooltip title="Strict accuracy across multiple thresholds">
                                <div style={{ cursor: 'help' }}>
                                    <Text style={{ fontSize: 11, color: '#666' }}>mAP50-95</Text>
                                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#faad14' }}>
                                        {(validation.mask_map50_95 || 0).toFixed(3)}
                                    </div>
                                </div>
                            </Tooltip>
                        </Card>
                    </Col>
                )}
            </Row>

            {/* Section 3: Class Grid (Hero + Class Cards) - Always visible */}
            <Card
                size="small"
                title={<span style={{ fontSize: 12 }}>🏆 Overall Model Score</span>}
                bodyStyle={{ padding: 12 }}
                style={{ marginBottom: 12 }}
            >
                <Row gutter={[12, 12]}>
                    <Col span={isSegmentation ? 12 : 24}>
                        <Tooltip title="F1 Score = Harmonic mean of Precision and Recall (balances false alarms vs missed defects)">
                            <div style={{ textAlign: 'center', cursor: 'help' }}>
                                <Progress
                                    type="dashboard"
                                    percent={Math.round(boxF1 * 100)}
                                    strokeColor="#1890ff"
                                    format={(percent) => `${percent}%`}
                                />
                                <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>Box F1 Score</div>
                            </div>
                        </Tooltip>
                    </Col>
                    {isSegmentation && (
                        <Col span={12}>
                            <Tooltip title="F1 Score = Harmonic mean of Precision and Recall (balances false alarms vs missed defects)">
                                <div style={{ textAlign: 'center', cursor: 'help' }}>
                                    <Progress
                                        type="dashboard"
                                        percent={Math.round(maskF1 * 100)}
                                        strokeColor="#722ed1"
                                        format={(percent) => `${percent}%`}
                                    />
                                    <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>Mask F1 Score</div>
                                </div>
                            </Tooltip>
                        </Col>
                    )}
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


            {/* Section 4: Per-Class Performance */}
            {classes.length > 0 && (
                <div>
                    <Title level={5} style={{ fontSize: 12, marginBottom: 8 }}>Per-Class Performance</Title>
                    <Row gutter={[12, 12]}>
                        {classes.map((cls, idx) => {
                            // Calculate F1 scores for this class
                            const classBoxF1 = (cls.box_p && cls.box_r)
                                ? (2 * cls.box_p * cls.box_r) / (cls.box_p + cls.box_r)
                                : 0;
                            const classMaskF1 = (cls.mask_p && cls.mask_r)
                                ? (2 * cls.mask_p * cls.mask_r) / (cls.mask_p + cls.mask_r)
                                : 0;

                            return (
                                <Col span={24} key={idx}>
                                    <Card
                                        size="small"
                                        title={
                                            <span style={{ fontSize: 12 }}>
                                                {cls.class} <Tag color="blue" style={{ marginLeft: 8 }}>{cls.instances} instances</Tag>
                                            </span>
                                        }
                                        bodyStyle={{ padding: 12 }}
                                        style={{ marginBottom: 8 }}
                                    >
                                        {/* F1 Score Row */}
                                        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                                            <Col span={isSegmentation ? 12 : 24}>
                                                <Tooltip title="F1 Score = Harmonic mean of Precision and Recall (balances false alarms vs missed defects)">
                                                    <div style={{ textAlign: 'center', cursor: 'help' }}>
                                                        <Progress
                                                            type="dashboard"
                                                            percent={Math.round(classBoxF1 * 100)}
                                                            width={80}
                                                            strokeColor="#1890ff"
                                                        />
                                                        <div style={{ fontSize: 11, marginTop: 4 }}>Box F1</div>
                                                    </div>
                                                </Tooltip>
                                            </Col>
                                            {isSegmentation && (
                                                <Col span={12}>
                                                    <Tooltip title="F1 Score = Harmonic mean of Precision and Recall (balances false alarms vs missed defects)">
                                                        <div style={{ textAlign: 'center', cursor: 'help' }}>
                                                            <Progress
                                                                type="dashboard"
                                                                percent={Math.round(classMaskF1 * 100)}
                                                                width={80}
                                                                strokeColor="#722ed1"
                                                            />
                                                            <div style={{ fontSize: 11, marginTop: 4 }}>Mask F1</div>
                                                        </div>
                                                    </Tooltip>
                                                </Col>
                                            )}
                                        </Row>

                                        {/* Box and Mask Details */}
                                        <Row gutter={[12, 12]}>
                                            {/* Box Detection Card */}
                                            <Col span={isSegmentation ? 12 : 24}>
                                                <Card
                                                    size="small"
                                                    title={<span style={{ fontSize: 11 }}>📦 BOX DETECTION</span>}
                                                    style={{
                                                        background: '#f8f9fa',
                                                        borderTop: '2px solid #1890ff',
                                                        borderRadius: 4,
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                                    }}
                                                    bodyStyle={{ padding: 12 }}
                                                >
                                                    <Tooltip title="Correct predictions (avoids false alarms)">
                                                        <div style={{ marginBottom: 12, cursor: 'help' }}>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>Precision</Text>
                                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>
                                                                {((cls.box_p || 0) * 100).toFixed(1)}%
                                                            </div>
                                                            <Progress
                                                                percent={Math.round((cls.box_p || 0) * 100)}
                                                                strokeColor="#52c41a"
                                                                showInfo={false}
                                                                size="small"
                                                            />
                                                        </div>
                                                    </Tooltip>

                                                    <Tooltip title="Objects detected (catches all defects)">
                                                        <div style={{ marginBottom: 12, cursor: 'help' }}>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>Recall</Text>
                                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>
                                                                {((cls.box_r || 0) * 100).toFixed(1)}%
                                                            </div>
                                                            <Progress
                                                                percent={Math.round((cls.box_r || 0) * 100)}
                                                                strokeColor="#1890ff"
                                                                showInfo={false}
                                                                size="small"
                                                            />
                                                        </div>
                                                    </Tooltip>

                                                    <Tooltip title="Overall accuracy at 50% overlap">
                                                        <div style={{ marginBottom: 8, cursor: 'help' }}>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>mAP50</Text>
                                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>
                                                                {(cls.box_map50 || 0).toFixed(3)}
                                                            </div>
                                                        </div>
                                                    </Tooltip>

                                                    <Tooltip title="Strict accuracy across multiple thresholds">
                                                        <div style={{ cursor: 'help' }}>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>mAP50-95</Text>
                                                            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#faad14' }}>
                                                                {(cls.box_map50_95 || 0).toFixed(3)}
                                                            </div>
                                                        </div>
                                                    </Tooltip>
                                                </Card>
                                            </Col>

                                            {/* Mask Segmentation Card - Only for segmentation tasks */}
                                            {isSegmentation && (
                                                <Col span={12}>
                                                    <Card
                                                        size="small"
                                                        title={<span style={{ fontSize: 11 }}>🎭 MASK SEGMENTATION</span>}
                                                        style={{
                                                            background: '#f8f9fa',
                                                            borderTop: '2px solid #722ed1',
                                                            borderRadius: 4,
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                                        }}
                                                        bodyStyle={{ padding: 12 }}
                                                    >
                                                        <Tooltip title="Correct predictions (avoids false alarms)">
                                                            <div style={{ marginBottom: 12, cursor: 'help' }}>
                                                                <Text style={{ fontSize: 11, color: '#666' }}>Precision</Text>
                                                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a', marginBottom: 4 }}>
                                                                    {((cls.mask_p || 0) * 100).toFixed(1)}%
                                                                </div>
                                                                <Progress
                                                                    percent={Math.round((cls.mask_p || 0) * 100)}
                                                                    strokeColor="#52c41a"
                                                                    showInfo={false}
                                                                    size="small"
                                                                />
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip title="Objects detected (catches all defects)">
                                                            <div style={{ marginBottom: 12, cursor: 'help' }}>
                                                                <Text style={{ fontSize: 11, color: '#666' }}>Recall</Text>
                                                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>
                                                                    {((cls.mask_r || 0) * 100).toFixed(1)}%
                                                                </div>
                                                                <Progress
                                                                    percent={Math.round((cls.mask_r || 0) * 100)}
                                                                    strokeColor="#1890ff"
                                                                    showInfo={false}
                                                                    size="small"
                                                                />
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip title="Overall accuracy at 50% overlap">
                                                            <div style={{ marginBottom: 8, cursor: 'help' }}>
                                                                <Text style={{ fontSize: 11, color: '#666' }}>mAP50</Text>
                                                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>
                                                                    {(cls.mask_map50 || 0).toFixed(3)}
                                                                </div>
                                                            </div>
                                                        </Tooltip>

                                                        <Tooltip title="Strict accuracy across multiple thresholds">
                                                            <div style={{ cursor: 'help' }}>
                                                                <Text style={{ fontSize: 11, color: '#666' }}>mAP50-95</Text>
                                                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#faad14' }}>
                                                                    {(cls.mask_map50_95 || 0).toFixed(3)}
                                                                </div>
                                                            </div>
                                                        </Tooltip>
                                                    </Card>
                                                </Col>
                                            )}
                                        </Row>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                </div>
            )}


        </div>
    );
};

export default LiveTrainingDashboard;
