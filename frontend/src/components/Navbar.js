import React from 'react';
import { Menu, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  RobotOutlined,
  ProjectOutlined,
  ToolOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../utils/professional_logger';
import { useAppMode } from '../context/AppModeContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRetrainingMode, toggleMode } = useAppMode();

  // Log component initialization
  logInfo('app.frontend.ui', 'navbar_initialized', 'Navbar component initialized', {
    timestamp: new Date().toISOString(),
    component: 'Navbar',
    currentLocation: location.pathname,
    function: 'component_initialization'
  });

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/models',
      icon: <RobotOutlined />,
      label: 'Models',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: 'Projects',
    },
  ];

  const handleMenuClick = ({ key }) => {
    logUserClick('navbar_menu_clicked', `User clicked navbar menu item: ${key}`);
    logInfo('app.frontend.navigation', 'navbar_navigation', 'Navigation triggered from navbar', {
      timestamp: new Date().toISOString(),
      fromPath: location.pathname,
      toPath: key,
      function: 'handleMenuClick'
    });
    navigate(key);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      {(() => {
        logInfo('app.frontend.ui', 'navbar_rendered', 'Navbar component rendered', {
          timestamp: new Date().toISOString(),
          component: 'Navbar',
          currentLocation: location.pathname,
          function: 'component_render'
        });
        return null;
      })()}
      <div style={{
        color: 'white',
        fontSize: '1.25rem',
        fontWeight: 'bold',
        marginRight: '2.5rem',
        marginLeft: '1.5rem',
        whiteSpace: 'nowrap'
      }}>
        Gevis AI Studio
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ flex: 1, minWidth: 0 }}
      />

      {/* Mode Toggle — segmented switcher, both options always visible */}
      <Tooltip
        title="Switch between Full Mode and User Retraining Mode"
        placement="bottomRight"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          padding: '3px',
          marginRight: '1.25rem',
          gap: '2px',
          userSelect: 'none',
        }}>
          {/* Full Mode segment */}
          <div
            onClick={() => {
              if (isRetrainingMode) {
                logUserClick('mode_toggle_clicked', 'Switched to Full Mode');
                toggleMode();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.28rem 0.75rem',
              borderRadius: '6px',
              cursor: isRetrainingMode ? 'pointer' : 'default',
              background: !isRetrainingMode ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: !isRetrainingMode ? '#fff' : 'rgba(255,255,255,0.4)',
              fontWeight: !isRetrainingMode ? 600 : 400,
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.18s',
            }}
          >
            <ToolOutlined style={{ fontSize: '0.78rem' }} />
            Full Mode
          </div>

          {/* User Retraining Mode segment */}
          <div
            onClick={() => {
              if (!isRetrainingMode) {
                logUserClick('mode_toggle_clicked', 'Switched to User Retraining Mode');
                toggleMode();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.28rem 0.75rem',
              borderRadius: '6px',
              cursor: !isRetrainingMode ? 'pointer' : 'default',
              background: isRetrainingMode ? '#6d28d9' : 'transparent',
              boxShadow: isRetrainingMode ? '0 0 0 1px #7c3aed' : 'none',
              color: isRetrainingMode ? '#fff' : 'rgba(255,255,255,0.4)',
              fontWeight: isRetrainingMode ? 600 : 400,
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.18s',
            }}
          >
            <ReloadOutlined style={{ fontSize: '0.78rem' }} />
            User Retraining Mode
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

export default Navbar;