import React, { useMemo } from 'react'

export default function ConfigView({ mode, resolvedConfig }) {
  const yamlText = useMemo(() => {
    const cfg = resolvedConfig || {}
    const out = []
    const train = cfg.train || {}
    const order = ['epochs','imgsz','batch','amp','device','early_stop','save_best','resume','model']
    out.push('train:')
    order.forEach(k => {
      if (train[k] !== undefined && train[k] !== null && train[k] !== '') {
        out.push(`  ${k}: ${typeof train[k] === 'boolean' ? (train[k] ? 'true' : 'false') : train[k]}`)
      }
    })
    return out.join('\n')
  }, [resolvedConfig, mode])

  return (
    <pre style={{ background: '#fafafa', padding: 8, borderRadius: 6, margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.5 }}>{yamlText}</pre>
  )
}