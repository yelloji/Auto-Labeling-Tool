import React from 'react';
import { Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * ManualClassPopup Component
 * 
 * A premium, floating UI component for selecting a classification label 
 * for a manually drawn bounding box. 
 */
const ManualClassPopup = ({ visible, labels, onSelect, onCancel, position }) => {
    if (!visible || !position) return null;

    // Smart positioning to keep it on screen
    const left = Math.min(window.innerWidth - 250, Math.max(20, position.x));
    const top = Math.min(window.innerHeight - 300, Math.max(80, position.y));

    return (
        <div style={{
            position: 'fixed', // Use fixed to float above everything else
            left: left,
            top: top,
            zIndex: 3000,
            background: 'rgba(15, 15, 15, 0.9)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(163, 53, 238, 0.2)',
            borderRadius: '16px',
            padding: '16px',
            width: '240px',
            animation: 'popupEntrance 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
            userSelect: 'none'
        }}>
            <style>
                {`
                @keyframes popupEntrance {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
                }
                `}
            </style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 4, height: 16, background: '#a335ee', borderRadius: '2px', boxShadow: '0 0 10px #a335ee' }} />
                    <Text style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        CLASSIFY DEFECT
                    </Text>
                </div>
                <div
                    onClick={onCancel}
                    style={{
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        padding: '4px',
                        display: 'flex'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >
                    <CloseOutlined />
                </div>
            </div>

            <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                paddingRight: '4px'
            }} className="custom-scrollbar">
                {labels.length > 0 ? labels.map(label => (
                    <div
                        key={label.id}
                        onClick={() => onSelect(label.name)}
                        style={{
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.2s cubic-bezier(0.19, 1, 0.22, 1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(163, 53, 238, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(163, 53, 238, 0.5)';
                            e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.transform = 'translateX(0)';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: label.color || '#a335ee', boxShadow: `0 0 6px ${label.color || '#a335ee'}` }} />
                            <Text style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>{label.name}</Text>
                        </div>
                        <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', fontWeight: 900 }}>PICK</Text>
                    </div>
                )) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '10px',
                        border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block' }}>No labels found in project.</Text>
                        <Text type="secondary" style={{ fontSize: '0.65rem' }}>Add labels in the project settings first.</Text>
                    </div>
                )}
            </div>

            <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'center'
            }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontStyle: 'italic', letterSpacing: '0.2px' }}>
                    Tip: Draw accurately to help the AI learn.
                </Text>
            </div>

            <style>
                {`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(163, 53, 238, 0.3);
                    borderRadius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(163, 53, 238, 0.6);
                }
                `}
            </style>
        </div>
    );
};

export default ManualClassPopup;
