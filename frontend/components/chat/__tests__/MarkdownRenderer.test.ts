import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '../MarkdownRenderer.vue'

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'Hello world' },
    })
    expect(wrapper.text()).toContain('Hello world')
  })

  it('renders bold text', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '**bold** text' },
    })
    expect(wrapper.html()).toContain('<strong>')
  })

  it('renders code blocks', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '`code` here' },
    })
    expect(wrapper.html()).toContain('<code>')
  })

  it('renders links with rel noopener noreferrer', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '[click](https://example.com)' },
    })
    expect(wrapper.html()).toContain('<a href')
    expect(wrapper.html()).toContain('rel="noopener noreferrer"')
  })

  it('renders lists', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '- item 1\n- item 2' },
    })
    expect(wrapper.html()).toContain('<ul>')
    expect(wrapper.text()).toContain('item 1')
    expect(wrapper.text()).toContain('item 2')
  })

  it('sanitizes HTML (does not render raw HTML)', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '<script>alert("xss")</script>' },
    })
    expect(wrapper.html()).not.toContain('<script>')
  })

  it('sanitizes event handlers in raw HTML', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '<img src="x" onerror="alert(1)">' },
    })
    // markdown-it escapes raw HTML, and sanitize-html strips any dangerous
    // attributes if html were enabled. The raw tag must not appear as DOM.
    expect(wrapper.html()).not.toContain('<img')
    expect(wrapper.html()).toContain('&lt;img')
  })
})
