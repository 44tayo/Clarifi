'use client'

import { useMemo, useState } from 'react'
import {
  ANTHROPIC_LEGACY_DIVIDER_BEFORE,
  BUILTIN_MODELS,
  DEFAULT_ACTIVE_MODEL_ID,
  PROVIDER_LABELS,
  PROVIDER_ORDER,
  groupBuiltinModelsByProvider,
  type BuiltinModel,
  type ModelProvider,
} from '@/lib/builtin-models'

export function ModelExploreDemo() {
  const groups = useMemo(() => groupBuiltinModelsByProvider(BUILTIN_MODELS), [])
  const [activeId, setActiveId] = useState(DEFAULT_ACTIVE_MODEL_ID)
  const [expanded, setExpanded] = useState<Set<ModelProvider>>(() => new Set())

  const toggleProvider = (provider: ModelProvider) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  const renderModelRow = (model: BuiltinModel) => {
    const isActive = model.id === activeId
    return (
      <button
        key={model.id}
        type="button"
        className={`model-explore-row${isActive ? ' active' : ''}`}
        onClick={() => setActiveId(model.id)}
      >
        <span className="model-explore-row-text">
          <span className="model-explore-row-name">{model.label}</span>
          <span className="model-explore-row-id">
            {model.modelId} · Built-in
          </span>
        </span>
        <span className={`model-explore-row-pill${isActive ? ' active' : ''}`}>
          {isActive ? 'Active' : 'Use'}
        </span>
      </button>
    )
  }

  return (
    <div className="model-explore-demo">
      <div className="model-explore-demo-header">
        <span className="model-explore-demo-title">Models</span>
        <span className="model-explore-demo-sub">
          Scroll to browse · tap to preview
        </span>
      </div>
      <div className="model-explore-scroll" aria-label="Built-in AI models">
        {PROVIDER_ORDER.map((provider) => {
          const models = groups.get(provider) ?? []
          if (models.length === 0) return null
          const isOpen = expanded.has(provider)
          const activeInGroup = models.some((m) => m.id === activeId)

          return (
            <div key={provider} className="model-explore-provider">
              <button
                type="button"
                className="model-explore-provider-header"
                onClick={() => toggleProvider(provider)}
                aria-expanded={isOpen}
              >
                <span className="model-explore-provider-chevron">{isOpen ? '▼' : '▶'}</span>
                <span>{PROVIDER_LABELS[provider]}</span>
                <span className="model-explore-provider-meta">
                  {models.length} models
                  {activeInGroup ? <span className="model-explore-provider-dot" /> : null}
                </span>
              </button>
              {isOpen && (
                <div className="model-explore-provider-body">
                  {provider === 'anthropic'
                    ? models.map((model) => (
                        <div key={model.id}>
                          {model.id === ANTHROPIC_LEGACY_DIVIDER_BEFORE && (
                            <div className="model-explore-divider" />
                          )}
                          {renderModelRow(model)}
                        </div>
                      ))
                    : models.map(renderModelRow)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
