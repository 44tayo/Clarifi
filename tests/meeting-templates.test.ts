import { describe, expect, it } from 'vitest'

import {
  MEETING_TEMPLATES,
  getMeetingTemplate,
  normalizeMeetingTemplateId,
} from '../shared/meetingTemplates'

describe('normalizeMeetingTemplateId', () => {
  it('accepts every known template id', () => {
    for (const template of MEETING_TEMPLATES) {
      expect(normalizeMeetingTemplateId(template.id)).toBe(template.id)
    }
  })

  it('falls back to general for unknown or missing values', () => {
    expect(normalizeMeetingTemplateId('bogus')).toBe('general')
    expect(normalizeMeetingTemplateId(undefined)).toBe('general')
    expect(normalizeMeetingTemplateId(null)).toBe('general')
    expect(normalizeMeetingTemplateId(42)).toBe('general')
  })
})

describe('getMeetingTemplate', () => {
  it('every template keeps the Summary and Action items headers', () => {
    for (const template of MEETING_TEMPLATES) {
      const resolved = getMeetingTemplate(template.id)
      expect(resolved.sections[0]).toBe('## Summary')
      expect(resolved.sections.at(-1)).toBe('## Action items')
    }
  })

  it('sales and standup templates have distinct, template-specific sections', () => {
    const sales = getMeetingTemplate('sales')
    const standup = getMeetingTemplate('standup')
    expect(sales.sections).toContain('## Objections')
    expect(standup.sections).toContain('## Blockers')
    expect(sales.sections).not.toEqual(standup.sections)
  })
})
