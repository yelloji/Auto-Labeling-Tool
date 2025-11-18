import React, { useState } from 'react';
import { Segmented, Tooltip, Modal, Input, Button, message } from 'antd';
import { trainingAPI } from '../../../../services/api';

export default function ModeToggle({ mode, onChange }) {
  const [showVerify, setShowVerify] = useState(false);
  const [password, setPassword] = useState('');
  const [showChange, setShowChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <strong>Mode</strong>
      </div>
      <Tooltip title="User mode: simple and safe. Developer mode: full control with advanced settings.">
        <Segmented
          value={mode}
          onChange={async (val) => {
            if (val === 'developer') {
              setShowVerify(true);
            } else {
              onChange(val);
            }
          }}
          options={[
            { label: 'User', value: 'user' },
            { label: 'Developer', value: 'developer' }
          ]}
        />
      </Tooltip>
      <div style={{ marginLeft: 8 }}>
        <Button size="small" onClick={() => setShowChange(true)}>Change Password</Button>
      </div>
      <Modal
        title="Developer Mode"
        open={showVerify}
        onCancel={() => { setShowVerify(false); setPassword(''); }}
        onOk={async () => {
          try {
            if (!password || password.length < 4) {
              message.error('Password must be at least 4 characters');
              return;
            }
            await trainingAPI.verifyDevPassword(password);
            setShowVerify(false);
            setPassword('');
            onChange('developer');
          } catch (e) {
            message.error(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Invalid password');
          }
        }}
        okText="Enter"
      >
        <Input.Password placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Modal>
      <Modal
        title="Change Developer Password"
        open={showChange}
        onCancel={() => { setShowChange(false); setCurrentPassword(''); setNewPassword(''); setNewPassword2(''); }}
        onOk={async () => {
          try {
            if (!newPassword || newPassword.length < 4 || newPassword !== newPassword2) {
              message.error('Password must be at least 4 characters and both entries must match');
              return;
            }
            await trainingAPI.changeDevPassword({ currentPassword, newPassword });
            setShowChange(false);
            setCurrentPassword(''); setNewPassword(''); setNewPassword2('');
            message.success('Password updated');
          } catch (e) {
            message.error(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Update failed');
          }
        }}
        okText="Update"
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <Input.Password placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <Input.Password placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input.Password placeholder="Repeat new password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}