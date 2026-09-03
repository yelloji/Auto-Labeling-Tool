import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Table, Select, Button, Typography, Divider, Empty, Spin, Space, Statistic, Row, Col, Tag, message } from 'antd';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { trainingAPI, handleAPIError } from '../../../../services/api';

const { Title, Text } = Typography;

const fmtPct = (v) => (v === null || v === undefined ? 'N/A' : `${(v * 100).toFixed(1)}%`);

const TrainingReportModal = ({ open, onClose, projectId, trainingId, trainingName, currentExperimentId }) => {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [addableExperiments, setAddableExperiments] = useState([]);
    const [selectedToAdd, setSelectedToAdd] = useState(null);
    const [adding, setAdding] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!projectId || !trainingId) return;
        setLoading(true);
        try {
            const [data, addable] = await Promise.all([
                trainingAPI.getReportData(projectId, trainingId),
                trainingAPI.getAddableExperiments(projectId, trainingId)
            ]);
            setReportData(data);
            const alreadyAdded = new Set((data?.sections || []).map((s) => s.experiment_id));
            setAddableExperiments((addable || []).filter((e) => !alreadyAdded.has(e.experiment_id)));
        } catch (error) {
            handleAPIError(error, 'Failed to load training report');
        } finally {
            setLoading(false);
        }
    }, [projectId, trainingId]);

    useEffect(() => {
        if (open) {
            setSelectedToAdd(null);
            fetchAll();
        }
    }, [open, fetchAll]);

    const handleAdd = async () => {
        if (!selectedToAdd) return;
        setAdding(true);
        try {
            await trainingAPI.addExperimentToReport(projectId, trainingId, selectedToAdd);
            message.success('Added to report.');
            setSelectedToAdd(null);
            fetchAll();
        } catch (error) {
            handleAPIError(error, 'Failed to add experiment to report');
        } finally {
            setAdding(false);
        }
    };

    const handleDownloadPdf = async () => {
        try {
            const { blob, filename } = await trainingAPI.downloadReport(projectId, trainingId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            handleAPIError(error, 'Failed to download report PDF');
        }
    };

    const composition = reportData?.composition;
    const allSections = reportData?.sections || [];
    const currentIsAdded = allSections.some((s) => s.experiment_id === currentExperimentId);
    const sections = allSections.filter((s) => s.experiment_id === currentExperimentId);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={`Analytic Report — ${trainingName || ''}`}
            width={900}
            footer={[
                <Button key="close" onClick={onClose}>Close</Button>,
                <Button key="pdf" icon={<DownloadOutlined />} type="primary" disabled={allSections.length === 0} onClick={handleDownloadPdf}>
                    Download PDF
                </Button>
            ]}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}><Spin /></div>
            ) : !reportData ? (
                <Empty description="No report data" />
            ) : (
                <>
                    <Title level={5}>Dataset Composition</Title>
                    <Text type="secondary">Release: {composition?.release_name || '-'}</Text>
                    <Table
                        style={{ marginTop: 8 }}
                        size="small"
                        pagination={false}
                        dataSource={[
                            { key: 'orig', label: 'Original Images', train: composition?.original_images?.train, val: composition?.original_images?.val, test: composition?.original_images?.test },
                            { key: 'tiles', label: 'Tiles', train: composition?.tiles?.train, val: composition?.tiles?.val, test: composition?.tiles?.test },
                        ]}
                        columns={[
                            { title: '', dataIndex: 'label', key: 'label' },
                            { title: 'Train', dataIndex: 'train', key: 'train', align: 'center' },
                            { title: 'Val', dataIndex: 'val', key: 'val', align: 'center' },
                            { title: 'Test', dataIndex: 'test', key: 'test', align: 'center' },
                        ]}
                    />
                    <Space style={{ marginTop: 8 }} wrap>
                        <Tag>Original Image Size: {composition?.original_image_size || '-'}</Tag>
                        <Tag>Tile Size: {composition?.tile_size || '-'}</Tag>
                        <Tag>Tile Grid: {composition?.tile_grid || '-'}</Tag>
                        <Tag>Label:Unlabeled Ratio: {composition?.label_unlabeled_ratio || '-'}</Tag>
                    </Space>

                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        <b>TP</b> = correctly detected &nbsp;&nbsp;
                        <b>FP</b> = false alarm, no crack there &nbsp;&nbsp;
                        <b>Doubt</b> = unclear, maybe real or not &nbsp;&nbsp;
                        <b>Missing</b> = real crack, model missed it
                    </Text>

                    <Divider />

                    <Space style={{ marginBottom: 12 }}>
                        <Select
                            placeholder="Add a reviewed experiment..."
                            style={{ width: 320 }}
                            value={selectedToAdd}
                            onChange={setSelectedToAdd}
                            options={addableExperiments.map((e) => ({
                                value: e.experiment_id,
                                label: `${e.experiment_name} (${e.split}, ${e.image_count} images)`
                            }))}
                            notFoundContent="No reviewed experiments available to add"
                        />
                        <Button icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectedToAdd} loading={adding}>
                            Add to Report
                        </Button>
                    </Space>

                    {sections.length === 0 ? (
                        <Empty description={
                            currentIsAdded || allSections.length === 0
                                ? "No experiments added to this report yet"
                                : "This experiment hasn't been added to the report yet — use \"Add to Report\" above."
                        } />
                    ) : (
                        sections.map((section) => (
                            <div key={section.experiment_id} style={{ marginBottom: 24 }}>
                                <Title level={5} style={{ marginBottom: 4 }}>
                                    {String(section.split).toUpperCase()} Set — {section.experiment_name} ({section.image_count} images)
                                </Title>
                                <Row gutter={16} style={{ marginBottom: 12 }}>
                                    <Col span={6}><Statistic title="True Positive" value={section.totals.tp} valueStyle={{ color: '#3f8600' }} /></Col>
                                    <Col span={6}><Statistic title="False Positive" value={section.totals.fp} valueStyle={{ color: '#cf1322' }} /></Col>
                                    <Col span={6}><Statistic title="Doubt" value={section.totals.doubt} valueStyle={{ color: '#d4b106' }} /></Col>
                                    <Col span={6}><Statistic title="Missing" value={section.totals.missing} valueStyle={{ color: '#fa8c16' }} /></Col>
                                </Row>
                                <Table
                                    size="small"
                                    pagination={false}
                                    scroll={{ y: 300 }}
                                    dataSource={section.per_image.map((img) => ({ ...img, key: img.image_name }))}
                                    columns={[
                                        { title: 'Image', dataIndex: 'image_name', key: 'image_name' },
                                        { title: 'TP', dataIndex: 'tp', key: 'tp', align: 'center' },
                                        { title: 'FP', dataIndex: 'fp', key: 'fp', align: 'center' },
                                        { title: 'Doubt', dataIndex: 'doubt', key: 'doubt', align: 'center' },
                                        { title: 'Missing', dataIndex: 'missing', key: 'missing', align: 'center' },
                                    ]}
                                    summary={() => (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0}><b>TOTAL</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="center"><b>{section.totals.tp}</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={2} align="center"><b>{section.totals.fp}</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={3} align="center"><b>{section.totals.doubt}</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={4} align="center"><b>{section.totals.missing}</b></Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                />
                                <Divider orientation="left" plain style={{ margin: '12px 0 4px' }}>Excluding Doubt</Divider>
                                <Row gutter={16}>
                                    <Col span={8}><Statistic title="Precision" value={fmtPct(section.metrics_excluding_doubt.precision)} /></Col>
                                    <Col span={8}><Statistic title="Recall" value={fmtPct(section.metrics_excluding_doubt.recall)} /></Col>
                                    <Col span={8}><Statistic title="Accuracy" value={fmtPct(section.metrics_excluding_doubt.accuracy)} /></Col>
                                </Row>
                                <Divider orientation="left" plain style={{ margin: '12px 0 4px' }}>Including Doubt (doubt counted as FP)</Divider>
                                <Row gutter={16}>
                                    <Col span={8}><Statistic title="Precision" value={fmtPct(section.metrics_including_doubt.precision)} /></Col>
                                    <Col span={8}><Statistic title="Recall" value={fmtPct(section.metrics_including_doubt.recall)} /></Col>
                                    <Col span={8}><Statistic title="Accuracy" value={fmtPct(section.metrics_including_doubt.accuracy)} /></Col>
                                </Row>
                            </div>
                        ))
                    )}

                </>
            )}
        </Modal>
    );
};

export default TrainingReportModal;
