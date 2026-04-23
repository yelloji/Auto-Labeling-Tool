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
  const isTopLevelModeSwitchPage = ['/', '/models', '/projects'].includes(location.pathname);
  const isModeToggleLocked = !isTopLevelModeSwitchPage;

  // Log component initialization
  logInfo('app.frontend.ui', 'navbar_initialized', 'Navbar component initialized', {
    timestamp: new Date().toISOString(),
    component: 'Navbar',
    currentLocation: location.pathname,
    function: 'component_initialization'
  });

  // In User Retraining Mode: only Projects is visible
  const menuItems = isRetrainingMode ? [
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: 'Projects',
    },
  ] : [
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
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
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

      {/* Mode Toggle — premium segmented switcher */}
      <Tooltip
        title={isModeToggleLocked
          ? 'Mode switching is locked inside project workflow. Go back to the main UI to switch mode.'
          : 'Switch between Full Mode and User Retraining Mode'}
        placement="bottomRight"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '3px',
          marginRight: '1.25rem',
          gap: '1px',
          userSelect: 'none',
          boxShadow: '0 1px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
          opacity: isModeToggleLocked ? 0.62 : 1,
        }}>

          {/* Full Mode segment */}
          <div
            onClick={() => {
              if (!isModeToggleLocked && isRetrainingMode) {
                logUserClick('mode_toggle_clicked', 'Switched to Full Mode');
                toggleMode();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.32rem 0.9rem',
              borderRadius: '7px',
              cursor: !isModeToggleLocked && isRetrainingMode ? 'pointer' : 'default',
              background: !isRetrainingMode
                ? 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)'
                : 'transparent',
              boxShadow: !isRetrainingMode
                ? 'inset 0 1px 0 rgba(255,255,255,0.12)'
                : 'none',
              color: !isRetrainingMode ? '#fff' : 'rgba(255,255,255,0.3)',
              fontWeight: !isRetrainingMode ? 600 : 400,
              fontSize: '0.78rem',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <ToolOutlined style={{ fontSize: '0.75rem', opacity: !isRetrainingMode ? 1 : 0.4 }} />
            Full Mode
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* User Retraining Mode segment */}
          <div
            onClick={() => {
              if (!isModeToggleLocked && !isRetrainingMode) {
                logUserClick('mode_toggle_clicked', 'Switched to User Retraining Mode');
                toggleMode();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.32rem 0.9rem',
              borderRadius: '7px',
              cursor: !isModeToggleLocked && !isRetrainingMode ? 'pointer' : 'default',
              background: isRetrainingMode
                ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                : 'transparent',
              boxShadow: isRetrainingMode
                ? 'inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'none',
              color: isRetrainingMode ? '#fff' : 'rgba(255,255,255,0.3)',
              fontWeight: isRetrainingMode ? 600 : 400,
              fontSize: '0.78rem',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <ReloadOutlined style={{ fontSize: '0.75rem', opacity: isRetrainingMode ? 1 : 0.4 }} />
            User Retraining Mode
          </div>

        </div>
      </Tooltip>
    </div>
  );
};

export default Navbar;
