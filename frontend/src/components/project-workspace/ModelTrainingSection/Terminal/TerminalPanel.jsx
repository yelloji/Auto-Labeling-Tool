import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Input, Modal, Space } from 'antd'
import { API_BASE_URL } from '../../../../config'

export default function TerminalPanel({ projectId, trainingName, visible, autoPrompt = true, onClose }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [logText, setLogText] = useState('')
  const wsRef = useRef(null)
  const preRef = useRef(null)

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [logText])

  const connect = async () => {
    try {
      setConnecting(true)
      const base = API_BASE_URL.replace(/^http/, 'ws')
      const url = `${base}/api/v1/training/session/terminal/logs?project_id=${encodeURIComponent(projectId)}&name=${encodeURIComponent(trainingName)}&password=${encodeURIComponent(password)}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => {
        setConnected(true)
      }
      ws.onmessage = (ev) => {
        const t = String(ev.data || '')
        setLogText(prev => prev + t)
      }
      ws.onclose = () => {
        setConnected(false)
      }
    } catch (e) {
    } finally {
      setConnecting(false)
      setOpen(false)
    }
  }

  const disconnect = () => {
    try {
      if (wsRef.current) wsRef.current.close()
    } catch {}
    if (typeof onClose === 'function') onClose()
  }

  useEffect(() => {
    if (visible && autoPrompt && !connected) {
      setOpen(true)
    }
  }, [visible])

  if (!visible) return null

  return (
    <Card size="small" title="AI Console" bodyStyle={{ padding: 12 }} style={{ position: 'fixed', right: 24, bottom: 24, width: 520, zIndex: 1000 }}
      extra={
        <Space>
          {!connected && (<Button size="small" type="primary" onClick={() => setOpen(true)}>Connect</Button>)}
          <Button size="small" onClick={disconnect}>Hide</Button>
        </Space>
      }
    >
      <div style={{ background: '#0b1e3b', color: '#c0c0c0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.4, borderRadius: 6, padding: 8, height: 260, overflow: 'auto' }} ref={preRef}>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{logText || 'Diagnostics hidden'}</pre>
      </div>

      <Modal open={open} title="Enter Terminal Password" onOk={connect} onCancel={() => setOpen(false)} confirmLoading={connecting} okText="Connect">
        <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Developer/terminal password" />
      </Modal>
    </Card>
  )
}