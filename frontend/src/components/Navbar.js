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

      {/* Mode Toggle — right side of nav bar */}
      <Tooltip
        title="Simplified mode for operators to retrain existing models"
        placement="bottomRight"
      >
        <div
          onClick={() => {
            logUserClick('mode_toggle_clicked', `Switched to ${isRetrainingMode ? 'Full Mode' : 'User Retraining Mode'}`);
            toggleMode();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            marginRight: '1.25rem',
            background: isRetrainingMode ? '#531dab' : 'rgba(255,255,255,0.08)',
            border: isRetrainingMode ? '1.5px solid #7c3aed' : '1.5px solid rgba(255,255,255,0.18)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            userSelect: 'none',
          }}
        >
          {isRetrainingMode
            ? <><ReloadOutlined style={{ fontSize: '0.85rem' }} /> User Retraining Mode</>
            : <><ToolOutlined style={{ fontSize: '0.85rem' }} /> Full Mode</>
          }
        </div>
      </Tooltip>
    </div>
  );
};

export default Navbar;