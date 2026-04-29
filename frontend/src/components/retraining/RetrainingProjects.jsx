import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Typography, Spin, Tag, Row, Col,
  Input, message
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, CalendarOutlined,
  SettingOutlined, CheckCircleOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

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

  const visibleProjects = projects.filter(project => project.has_reference);

  const filtered = visibleProjects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenProject = (project) => {
    navigate(`/retraining/${project.id}`);
  };

  const formatDate = (iso) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div style={{ padding: '2rem', background: '#001529', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1540, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            marginBottom: '1.1rem',
          }}
        >
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontSize: '2rem' }}>
              <ReloadOutlined style={{ marginRight: '0.6rem', color: '#7c3aed' }} />
              User Retraining Mode
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.94rem' }}>
              Select a developer-enabled project to continue retraining with new labeled images.
            </Text>
          </div>

          <Button
            icon={<ReloadOutlined />}
            onClick={loadProjects}
            style={{
              height: 42,
              paddingInline: 18,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              borderRadius: 10,
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
            }}
          >
            Refresh
          </Button>
        </div>

        <div
          style={{
            marginBottom: '1.5rem',
            maxWidth: 360,
          }}
        >
          <Text
            style={{
              display: 'block',
              color: 'rgba(255,255,255,0.62)',
              fontSize: '0.74rem',
              fontWeight: 600,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Search Projects
          </Text>
            <Input
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.38)' }} />}
            placeholder="Search enabled retraining projects"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              height: 42,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%)',
              border: '1px solid rgba(196,207,225,0.45)',
              color: '#fff',
              borderRadius: 10,
              boxShadow: '0 10px 22px rgba(9,30,66,0.08)',
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
            <Spin size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 2rem',
              color: 'rgba(255,255,255,0.42)',
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ReloadOutlined style={{ fontSize: '2.5rem', marginBottom: '1rem' }} />
            <div>{searchTerm ? 'No projects found' : 'No retraining projects available'}</div>
          </div>
        ) : (
          <Row gutter={[18, 18]}>
            {filtered.map(project => (
              <Col key={project.id} xs={24} md={12} xl={6}>
                <Card
                  onClick={() => handleOpenProject(project)}
                  hoverable
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(245,248,255,0.98) 0%, rgba(238,244,255,0.98) 100%)',
                    border: '1px solid rgba(160,174,208,0.32)',
                    borderRadius: 16,
                    cursor: 'pointer',
                    boxShadow: '0 18px 34px rgba(0,0,0,0.16), 0 1px 0 rgba(255,255,255,0.6) inset',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                  }}
                  bodyStyle={{ padding: '1rem 1rem 0.95rem' }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: '0 0 auto 0',
                      height: 2,
                      background: 'linear-gradient(90deg, #7c3aed 0%, #22c55e 100%)',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: 'linear-gradient(180deg, rgba(124,58,237,0.9) 0%, rgba(109,40,217,0.88) 100%)',
                        border: '1px solid rgba(124,58,237,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 18px rgba(91,45,178,0.18)',
                      }}
                    >
                      <SettingOutlined style={{ color: '#fff', fontSize: '0.98rem' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 6 }}>
                        <Text
                          strong
                          style={{
                            color: '#0f172a',
                            fontSize: '1rem',
                            lineHeight: 1.25,
                          }}
                        >
                          {project.name}
                        </Text>
                        <Tag
                          style={{
                            margin: 0,
                            borderRadius: 999,
                            paddingInline: 9,
                            fontSize: '0.68rem',
                            lineHeight: '20px',
                            height: 22,
                            background: '#f3e8ff',
                            color: '#6d28d9',
                            border: 'none',
                            fontWeight: 600,
                          }}
                        >
                          {project.project_type || 'Detection'}
                        </Tag>
                      </div>

                      <Text
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontSize: '0.8rem',
                          minHeight: 20,
                        }}
                      >
                        {project.description || 'No description'}
                      </Text>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.95rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0.34rem 0.76rem',
                      borderRadius: 999,
                      background: '#ecfdf3',
                      color: '#15803d',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      border: '1px solid rgba(34,197,94,0.18)',
                      boxShadow: '0 8px 18px rgba(34,197,94,0.12)',
                    }}
                  >
                    <CheckCircleOutlined />
                    Ready for retraining
                  </div>

                  <div
                    style={{
                      marginTop: '0.95rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid rgba(148,163,184,0.16)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '0.95rem',
                    }}
                  >
                    <div>
                      <Text
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: 4,
                        }}
                      >
                        Reference Set
                      </Text>
                      <Text style={{ color: '#1e293b', fontSize: '0.8rem' }}>
                        <CalendarOutlined style={{ marginRight: 6, color: '#94a3b8' }} />
                        {formatDate(project.reference?.assigned_at)}
                      </Text>
                    </div>

                    <div>
                      <Text
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: 4,
                        }}
                      >
                        Updated
                      </Text>
                      <Text style={{ color: '#1e293b', fontSize: '0.8rem' }}>
                        <CalendarOutlined style={{ marginRight: 6, color: '#94a3b8' }} />
                        {formatDate(project.updated_at)}
                      </Text>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.8rem',
                    }}
                  >
                    <Text style={{ color: '#475569', fontSize: '0.76rem' }}>
                      Open retraining workspace
                    </Text>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        background: '#ffffff',
                        border: '1px solid rgba(148,163,184,0.24)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 14px rgba(15,23,42,0.08)',
                      }}
                    >
                      <ArrowRightOutlined style={{ color: '#475569', fontSize: '0.78rem' }} />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
};

export default RetrainingProjects;
