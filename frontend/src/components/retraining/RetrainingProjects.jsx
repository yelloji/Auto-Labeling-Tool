import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Typography, Spin, Tag, Row, Col,
  Input, message, Tooltip
} from 'antd';
import {
  ReloadOutlined, LockOutlined, SearchOutlined,
  PictureOutlined, DatabaseOutlined, CalendarOutlined,
  SettingOutlined, CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const API_BASE = '/api/v1';

const RetrainingProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/retraining/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      message.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const visibleProjects = projects.filter(p => p.has_reference);

  const filtered = visibleProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenProject = (project) => {
    if (!project.has_reference) return;
    navigate(`/retraining/${project.id}`);
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ padding: '2rem', background: '#001529', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            <ReloadOutlined style={{ marginRight: '0.6rem', color: '#7c3aed' }} />
            User Retraining Mode
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
            Select a project to begin retraining its model with new images
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadProjects}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}
        >
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.25rem', maxWidth: 340 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.35)' }} />}
          placeholder="Search projects"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6 }}
        />
      </div>

      {/* Project Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '5rem', color: 'rgba(255,255,255,0.35)' }}>
          <ReloadOutlined style={{ fontSize: '2.5rem', marginBottom: '1rem' }} />
          <div>{searchTerm ? 'No projects found' : 'No retraining projects available'}</div>
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {filtered.map(project => {
            const locked = !project.has_reference;
            return (
              <Col key={project.id} xs={24} sm={12} lg={8}>
                <Tooltip
                  title={locked ? 'No production reference set for this project. Please contact your developer.' : ''}
                  placement="top"
                >
                  <Card
                    onClick={() => handleOpenProject(project)}
                    style={{
                      background: locked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                      border: locked
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(124,58,237,0.35)',
                      borderRadius: 10,
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked ? 0.65 : 1,
                      transition: 'border 0.2s, box-shadow 0.2s',
                    }}
                    hoverable={!locked}
                    bodyStyle={{ padding: '1rem 1.1rem' }}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                        background: locked ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {locked
                          ? <LockOutlined style={{ color: 'rgba(255,255,255,0.35)', fontSize: '1rem' }} />
                          : <SettingOutlined style={{ color: '#a78bfa', fontSize: '1rem' }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Text strong style={{ color: '#fff', fontSize: '0.95rem' }}>
                            {project.name}
                          </Text>
                          <Tag
                            color={project.project_type === 'segmentation' ? 'purple' : 'blue'}
                            style={{ fontSize: '0.7rem', margin: 0 }}
                          >
                            {project.project_type || 'Detection'}
                          </Tag>
                        </div>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                          {project.description || 'No description'}
                        </Text>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div style={{ marginTop: '0.75rem' }}>
                      {locked ? (
                        <Tag icon={<WarningOutlined />} color="warning" style={{ fontSize: '0.75rem' }}>
                          No reference set — contact developer
                        </Tag>
                      ) : (
                        <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: '0.75rem' }}>
                          Ready for retraining
                        </Tag>
                      )}
                    </div>

                    {/* Reference info */}
                    {project.reference && (
                      <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                        <CalendarOutlined style={{ marginRight: 4 }} />
                        Reference set: {formatDate(project.reference.assigned_at)}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{
                      marginTop: '0.85rem', paddingTop: '0.75rem',
                      borderTop: '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', gap: '1rem',
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                        <CalendarOutlined style={{ marginRight: 4 }} />
                        {formatDate(project.updated_at)}
                      </Text>
                    </div>
                  </Card>
                </Tooltip>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default RetrainingProjects;
