import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  RobotOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../utils/professional_logger';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
        fontSize: '20px', 
        fontWeight: 'bold', 
        marginRight: '40px',
        marginLeft: '24px'
      }}>
        🏷️ Auto-Labeling-Tool
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ flex: 1, minWidth: 0 }}
      />
    </div>
  );
};

export default Navbar;