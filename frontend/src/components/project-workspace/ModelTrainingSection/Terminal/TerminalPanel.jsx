import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Input, Modal, Space } from 'antd'
import { API_BASE_URL } from '../../../../config'

export default function TerminalPanel({ projectId, trainingName, visible, autoPrompt = true, onClose }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [logText, setLogText] = useState('')
  const [pos, setPos] = useState({ x: 24, y: 64 })
  const [size, setSize] = useState({ w: 520, h: 260 })
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

  const onDragStart = (e) => {
    const controls = e.target.closest('.ai-console-controls')
    if (controls) return
    const sx = e.clientX, sy = e.clientY
    const ix = pos.x, iy = pos.y
    let rafId = null
    const move = (ev) => {
      const nx = Math.max(12, ix + (ev.clientX - sx))
      const ny = Math.max(12, iy + (ev.clientY - sy))
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setPos({ x: nx, y: ny }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onResizeRight = (e) => {
    const sx = e.clientX
    const iw = size.w
    const move = (ev) => {
      const nw = Math.max(360, Math.min(1400, iw + (ev.clientX - sx)))
      setSize(s => ({ ...s, w: nw }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onResizeBottom = (e) => {
    const sy = e.clientY
    const ih = size.h
    const move = (ev) => {
      const nh = Math.max(140, Math.min(900, ih + (ev.clientY - sy)))
      setSize(s => ({ ...s, h: nh }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <Card size="small" title="AI Console" bodyStyle={{ padding: 12 }} style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, zIndex: 1000, userSelect: 'none' }}
      extra={
        <Space className="ai-console-controls">
          {!connected && (<Button size="small" type="primary" onClick={() => setOpen(true)}>Connect</Button>)}
          <Button size="small" onClick={disconnect}>Hide</Button>
        </Space>
      }
      onMouseDown={onDragStart}
    >
      <div style={{ background: '#0b1e3b', color: '#c0c0c0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.4, borderRadius: 6, padding: 8, height: size.h, overflow: 'auto' }} ref={preRef}>
        <pre style={{ whiteSpace: 'pre', margin: 0 }}>{logText || 'Diagnostics hidden'}</pre>
      </div>
      <div style={{ position: 'absolute', right: 0, top: '50%', width: 8, height: 40, cursor: 'ew-resize' }} onMouseDown={onResizeRight} />
      <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 40, height: 8, cursor: 'ns-resize' }} onMouseDown={onResizeBottom} />

      <Modal open={open} title="Enter Terminal Password" onOk={connect} onCancel={() => setOpen(false)} confirmLoading={connecting} okText="Connect">
        <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Developer/terminal password" />
      </Modal>
    </Card>
  )
}